<script setup lang="ts">
import {
  onMounted,
  ref,
  watch,
} from 'vue';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

import {
  useToast,
} from 'primevue/usetoast';

import DownloadIcon from '@primeicons/vue/download';
import FileExportIcon from '@primeicons/vue/file-export';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';

import {
  labelFr,
  optionsFr,
} from '../i18n/labels';

import {
  downloadReport,
  generateReport,
  getReportPreviewCount,
  getReports,
} from '../services/reports.service';

import {
  statusSeverity,
} from '../utils/status-severity';


interface ReportItem {
  id:
  number;

  reportType:
  string;

  format:
  'PDF'
  |
  'XLSX'
  |
  'CSV';

  generatedAt:
  string;

  filePath:
  string;

  periodStart:
  string;

  periodEnd:
  string;

  status:
  string;
}


interface WritableFile {
  write(
    data:
      Blob,
  ):
    Promise<void>;

  close():
    Promise<void>;
}


interface SaveFileHandle {
  createWritable():
    Promise<WritableFile>;
}


type SavePickerWindow =
  Window & {
    showSaveFilePicker?:
    (
      options: {
        suggestedName:
        string;

        types:
        Array<{
          description:
          string;

          accept:
          Record<
            string,
            string[]
          >;
        }>;
      },
    ) =>
      Promise<SaveFileHandle>;
  };


const reports =
  ref<ReportItem[]>([]);

const toast =
  useToast();

const loading =
  ref(false);

const generating =
  ref(false);

const downloading =
  ref<number[]>([]);


function isoDate(
  date:
    Date,
) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}


function isoWeek(
  date:
    Date,
) {
  const current =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );


  const day =
    current.getUTCDay()
    ||
    7;


  current.setUTCDate(
    current.getUTCDate()
    +
    4
    -
    day,
  );


  const yearStart =
    new Date(
      Date.UTC(
        current.getUTCFullYear(),
        0,
        1,
      ),
    );


  const week =
    Math.ceil(
      (
        (
          (
            current.getTime()
            -
            yearStart.getTime()
          )
          /
          86400000
        )
        +
        1
      )
      /
      7,
    );


  return `${current.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}


const today =
  new Date();


const selectedMonth =
  ref(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
  );


const selectedWeek =
  ref(
    isoWeek(
      today,
    ),
  );


const form =
  ref({
    reportType:
      'WEEKLY',

    periodStart:
      '',

    periodEnd:
      '',

    format:
      'PDF',

    publishedOnly:
      true,
  });

const reportPreviewCount = ref<number | null>(null);
const reportPreviewLoading = ref(false);
const reportPreviewError = ref('');
let reportPreviewRequest = 0;


const reportTypeOptions =
  optionsFr([
    'WEEKLY',
    'MONTHLY',
    'CUSTOM',
  ]);


const formatOptions = [
  'PDF',
  'XLSX',
  'CSV',
];


const dateFormatter =
  new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  );


function formatDate(
  value:
    string
    |
    null
    |
    undefined,
) {
  if (
    !value
  ) {
    return 'Non renseignée';
  }

  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? 'Non renseignée'
    : dateFormatter.format(
      date,
    );
}


function fileExtension(
  format:
    ReportItem['format'],
) {
  return format.toLowerCase();
}


function contentType(
  format:
    ReportItem['format'],
) {
  if (
    format ===
    'PDF'
  ) {
    return 'application/pdf';
  }

  if (
    format ===
    'XLSX'
  ) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  return 'text/csv';
}


function reportFileName(
  reportType:
    string,

  periodStart:
    string,

  periodEnd:
    string,

  format:
    ReportItem['format'],
) {
  const cleanType =
    labelFr(
      reportType,
    )
      .normalize(
        'NFD',
      )
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      );


  return `rapport-veille-${cleanType}-${periodStart}-au-${periodEnd}.${fileExtension(format)}`;
}


function formatPeriod(
  report:
    ReportItem,
) {
  const formatter =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        dateStyle:
          'short',

        timeZone:
          'UTC',
      },
    );


  return `Du ${formatter.format(new Date(`${report.periodStart}T00:00:00Z`))} au ${formatter.format(new Date(`${report.periodEnd}T00:00:00Z`))}`;
}


function applyAutomaticPeriod() {
  if (
    form.value.reportType ===
    'MONTHLY'
  ) {
    const [
      year,
      month,
    ] =
      selectedMonth.value
        .split(
          '-',
        )
        .map(
          Number,
        );

    if (
      !year
      ||
      !month
    ) {
      return;
    }

    form.value.periodStart =
      `${year}-${String(month).padStart(2, '0')}-01`;

    form.value.periodEnd =
      isoDate(
        new Date(
          Date.UTC(
            year,
            month,
            0,
          ),
        ),
      );

    return;
  }


  if (
    form.value.reportType ===
    'WEEKLY'
  ) {
    const match =
      selectedWeek.value.match(
        /^(\d{4})-W(\d{2})$/,
      );

    if (
      !match
    ) {
      return;
    }


    const year =
      Number(
        match[1],
      );

    const week =
      Number(
        match[2],
      );


    const januaryFourth =
      new Date(
        Date.UTC(
          year,
          0,
          4,
        ),
      );


    const monday =
      new Date(
        januaryFourth,
      );


    monday.setUTCDate(
      januaryFourth.getUTCDate()
      -
      (
        januaryFourth.getUTCDay()
        ||
        7
      )
      +
      1
      +
      (
        week - 1
      )
      *
      7,
    );


    const sunday =
      new Date(
        monday,
      );


    sunday.setUTCDate(
      monday.getUTCDate()
      +
      6,
    );


    form.value.periodStart =
      isoDate(
        monday,
      );

    form.value.periodEnd =
      isoDate(
        sunday,
      );
  }
}


watch(
  [
    () =>
      form.value.reportType,

    selectedMonth,

    selectedWeek,
  ],

  applyAutomaticPeriod,

  {
    immediate:
      true,
  },
);

async function refreshReportPreview() {
  const requestId = ++reportPreviewRequest;
  if (!form.value.periodStart || !form.value.periodEnd) {
    reportPreviewCount.value = null;
    return;
  }
  reportPreviewLoading.value = true;
  reportPreviewError.value = '';
  try {
    const response = await getReportPreviewCount({
      periodStart: form.value.periodStart,
      periodEnd: form.value.periodEnd,
      publishedOnly: form.value.publishedOnly,
    });
    if (requestId === reportPreviewRequest) reportPreviewCount.value = response.data.count;
  } catch {
    if (requestId === reportPreviewRequest) {
      reportPreviewCount.value = null;
      reportPreviewError.value = 'Le nombre de veilles correspondantes n’a pas pu être vérifié.';
    }
  } finally {
    if (requestId === reportPreviewRequest) reportPreviewLoading.value = false;
  }
}

watch(
  [() => form.value.periodStart, () => form.value.periodEnd, () => form.value.publishedOnly],
  () => { void refreshReportPreview(); },
  { immediate: true },
);


async function chooseDestination(
  format:
    ReportItem['format'],

  suggestedName:
    string,
) {
  const picker =
    (
      window as
      SavePickerWindow
    ).showSaveFilePicker;


  if (
    !picker
  ) {
    return undefined;
  }


  try {
    return await picker({
      suggestedName,

      types: [
        {
          description:
            `Rapport ${format}`,

          accept: {
            [
              contentType(
                format,
              )
            ]: [
                `.${fileExtension(format)}`,
              ],
          },
        },
      ],
    });

  } catch (
  error
  ) {
    if (
      error instanceof
      DOMException
      &&
      error.name ===
      'AbortError'
    ) {
      return null;
    }

    throw error;
  }
}


function buildAndValidateBlob(
  data:
    ArrayBuffer,

  format:
    ReportItem['format'],
) {
  const bytes =
    new Uint8Array(
      data,
    );


  const valid =
    format ===
      'PDF'

      ? bytes.length >=
      5
      &&
      String.fromCharCode(
        ...bytes.slice(
          0,
          5,
        ),
      ) ===
      '%PDF-'

      : format ===
        'XLSX'

        ? bytes.length >=
        2
        &&
        bytes[0] ===
        0x50
        &&
        bytes[1] ===
        0x4b

        : bytes.length >
        0;


  if (
    !valid
  ) {
    throw new Error(
      `Le fichier ${format} reçu est invalide.`,
    );
  }


  return new Blob(
    [
      data,
    ],

    {
      type:
        contentType(
          format,
        ),
    },
  );
}


async function saveBlob(
  data:
    ArrayBuffer,

  format:
    ReportItem['format'],

  fileName:
    string,

  destination?:
    SaveFileHandle,
) {
  const blob =
    buildAndValidateBlob(
      data,
      format,
    );


  if (
    destination
  ) {
    const writable =
      await destination.createWritable();

    await writable.write(
      blob,
    );

    await writable.close();

    return;
  }


  const url =
    URL.createObjectURL(
      blob,
    );


  const link =
    document.createElement(
      'a',
    );


  link.href =
    url;

  link.download =
    fileName;

  link.click();


  URL.revokeObjectURL(
    url,
  );
}


async function load() {
  loading.value =
    true;

  try {
    reports.value =
      (
        await getReports()
      ).data;

  } finally {
    loading.value =
      false;
  }
}


async function download(
  report:
    ReportItem,
) {
  const fileName =
    reportFileName(
      report.reportType,
      report.periodStart,
      report.periodEnd,
      report.format,
    );


  const destination =
    await chooseDestination(
      report.format,
      fileName,
    );


  if (
    destination ===
    null
  ) {
    return;
  }


  downloading.value = [
    ...downloading.value,
    report.id,
  ];


  try {
    const response =
      await downloadReport(
        report.id,
      );


    await saveBlob(
      response.data,
      report.format,
      fileName,
      destination,
    );


    await load();


    toast.add({
      severity:
        'success',

      summary:
        'Rapport enregistré',

      detail:
        `${fileName} a été enregistré avec succès.`,

      life:
        4000,
    });

  } catch {
    toast.add({
      severity:
        'error',

      summary:
        'Téléchargement impossible',

      detail:
        'Le rapport n’a pas pu être enregistré.',

      life:
        4000,
    });

  } finally {
    downloading.value =
      downloading.value.filter(
        (
          id,
        ) =>
          id !==
          report.id,
      );
  }
}


async function generate() {
  if (reportPreviewCount.value === 0 || reportPreviewLoading.value || reportPreviewCount.value === null) return;
  const format =
    form.value.format as
    ReportItem['format'];


  const suggestedName =
    reportFileName(
      form.value.reportType,
      form.value.periodStart,
      form.value.periodEnd,
      format,
    );


  const destination =
    await chooseDestination(
      format,
      suggestedName,
    );


  if (
    destination ===
    null
  ) {
    return;
  }


  generating.value =
    true;


  try {
    const response =
      await generateReport({
        reportType:
          form.value.reportType,

        periodStart:
          form.value.periodStart,

        periodEnd:
          form.value.periodEnd,

        format:
          form.value.format,

        publishedOnly:
          form.value.publishedOnly,
      });


    const report =
      response.data as
      ReportItem;


    await load();


    try {
      const file =
        await downloadReport(
          report.id,
        );


      await saveBlob(
        file.data,
        format,
        suggestedName,
        destination,
      );


      toast.add({
        severity:
          'success',

        summary:
          'Rapport généré et enregistré',

        detail:
          `${suggestedName} est prêt à être consulté.`,

        life:
          4500,
      });

    } catch {
      toast.add({
        severity:
          'warn',

        summary:
          'Rapport généré',

        detail:
          'Le rapport a été créé, mais son enregistrement sur l’ordinateur a échoué. Utilisez le bouton Télécharger pour réessayer.',

        life:
          6000,
      });
    }

  } catch {
    toast.add({
      severity:
        'error',

      summary:
        'Génération impossible',

      detail:
        'Le rapport n’a pas pu être généré ou enregistré.',

      life:
        4500,
    });

  } finally {
    generating.value =
      false;
  }
}


onMounted(
  load,
);
</script>


<template>
  <AppLayout>

    <div class="reports-page">

      <PageHeader title="Rapports" subtitle="Générez et téléchargez les synthèses de veille selon la période souhaitée."
        eyebrow="Diffusion" icon="pi pi-chart-bar" />


      <SectionCard title="Générer un rapport" icon="pi pi-file-export">

        <div class="report-form">

          <div class="field-group select-host">

            <label class="required-label">
              Périodicité
            </label>

            <div class="select-host">
              <Select append-to="self" id="report-type" v-model="form.reportType
                " :options="reportTypeOptions
                " option-label="label" option-value="value" placeholder="Sélectionner une périodicité"
                class="w-full" />
            </div>

          </div>


          <div class="field-group">

            <label :class="{ 'required-label': form.reportType === 'MONTHLY' }">
              Mois
            </label>

            <InputText v-model="selectedMonth
              " type="month" class="w-full" :disabled="form.reportType !==
                'MONTHLY'
                " />

          </div>


          <div class="field-group">

            <label :class="{ 'required-label': form.reportType === 'WEEKLY' }">
              Semaine
            </label>

            <InputText v-model="selectedWeek
              " type="week" class="w-full" :disabled="form.reportType !==
                'WEEKLY'
                " />

          </div>


          <div class="field-group">

            <label :class="{ 'required-label': form.reportType === 'CUSTOM' }">
              Date de début
            </label>

            <InputText v-model="form.periodStart
              " type="date" class="w-full" :disabled="form.reportType !==
                'CUSTOM'
                " />

          </div>


          <div class="field-group">

            <label :class="{ 'required-label': form.reportType === 'CUSTOM' }">
              Date de fin
            </label>

            <InputText v-model="form.periodEnd
              " type="date" class="w-full" :disabled="form.reportType !==
                'CUSTOM'
                " :min="form.periodStart
                  " />

          </div>


          <div class="field-group select-host">

            <label class="required-label">
              Format
            </label>

            <div class="select-host">
              <Select append-to="self" v-model="form.format
                " :options="formatOptions
                " placeholder="Format" class="w-full" />
            </div>

          </div>

        </div>


        <div class="report-scope">
          <Checkbox v-model="form.publishedOnly" inputId="published-only" binary />
          <label for="published-only">Veilles publiées uniquement</label>
        </div>


        <div class="report-helper">

          <i class="pi pi-info-circle" />

          <span>
            Les dates sont calculées automatiquement pour les rapports hebdomadaires et mensuels.
            Case cochée : date de publication ; décochée : date de collecte.
          </span>

        </div>


        <div class="report-preview" aria-live="polite">
          <span v-if="reportPreviewLoading">Vérification des veilles correspondantes…</span>
          <Message v-else-if="reportPreviewCount === 0" severity="warn" :closable="false">
            {{ form.publishedOnly ? 'Aucune veille publiée pour cette période.' : 'Aucune veille collectée pour cette période.' }}
          </Message>
          <span v-else-if="reportPreviewCount !== null">
            {{ reportPreviewCount === 1 ? 'Une veille sera incluse.' : `${reportPreviewCount} veilles seront incluses.`
            }}
          </span>
          <span v-if="reportPreviewError" class="report-preview-error">{{ reportPreviewError }}</span>
        </div>


        <Button label="Générer et enregistrer" :loading="generating
          " :disabled="!form.periodStart
            ||
            !form.periodEnd
            || reportPreviewLoading
            || reportPreviewCount === null
            || reportPreviewCount === 0
            " @click="
              generate
            ">
          <template #icon>
            <FileExportIcon size="0.9rem" />
          </template>
        </Button>

      </SectionCard>


      <SectionCard :title="`${reports.length} rapport${reports.length > 1 ? 's' : ''}`
        " subtitle="Historique des rapports générés." icon="pi pi-folder">

        <div v-if="loading && reports.length === 0" class="reports-empty" role="status">
          Chargement des rapports…
        </div>

        <div v-else-if="reports.length === 0" class="reports-empty">
          Aucun rapport généré pour le moment.
        </div>

        <div v-else class="reports-grid">
          <article v-for="report in reports" :key="report.id" class="report-card">
            <div class="report-card-heading">
              <div class="report-icon" aria-hidden="true">
                <i class="pi pi-file-export" />
              </div>
              <div class="report-title-group">
                <h3>Rapport {{ labelFr(report.reportType) }}</h3>
                <span class="report-periodicity">Périodicité {{ labelFr(report.reportType) }}</span>
              </div>
              <Tag :value="labelFr(report.status)" :severity="statusSeverity(report.status)" />
            </div>

            <div class="report-period">
              <span class="report-meta-label">P?riode couverte</span>
              <strong>{{ formatPeriod(report) }}</strong>
            </div>

            <div class="report-card-footer">
              <div class="report-meta">
                <span class="report-format">{{ report.format }}</span>
                <span>G?n?r? le {{ formatDate(report.generatedAt) }}</span>
              </div>
              <Button label="T?l?charger" size="small" severity="secondary"
                :loading="downloading.includes(report.id)" @click="download(report)">
                <template #icon>
                  <DownloadIcon size="0.8rem" />
                </template>
              </Button>
            </div>
          </article>
        </div>

      </SectionCard>

    </div>

  </AppLayout>
</template>


<style scoped>
.reports-page {
  display:
    grid;

  gap:
    1rem;
}

:deep(.section-card) {
  overflow:
    visible;
}

.report-form {
  display:
    grid;

  grid-template-columns:
    repeat(3,
      minmax(0,
        1fr));

  gap:
    0.8rem;

  margin-bottom:
    0.9rem;
}

.report-scope {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.9rem;
  color: var(--app-text);
  font-size: 0.86rem;
  font-weight: 650;
}

.report-scope label {
  cursor: pointer;
}

.report-preview {
  margin: 0.75rem 0;
  color: var(--app-text-secondary);
  font-size: 0.82rem;
}

.report-preview :deep(.p-message) {
  margin: 0;
}

.report-preview-error {
  color: var(--app-danger, #dc2626);
}

.field-group {
  display:
    grid;

  gap:
    0.4rem;
}

.field-group label {
  color:
    var(--app-text-secondary);

  font-size:
    0.7rem;

  font-weight:
    700;
}

.report-helper {
  display:
    flex;

  max-width:
    50rem;

  align-items:
    flex-start;

  gap:
    0.45rem;

  margin-bottom:
    0.8rem;

  color:
    var(--app-text-muted);

  font-size:
    0.68rem;

  line-height:
    1.5;
}

.report-helper i {
  margin-top:
    0.1rem;

  color:
    var(--app-primary);
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 0.85rem;
}

.report-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--app-border, rgba(148, 163, 184, 0.18));
  border-radius: 0.9rem;
  background: var(--app-surface-raised, rgba(15, 30, 48, 0.55));
}

.report-card-heading,
.report-card-footer,
.report-meta {
  display: flex;
  align-items: center;
}

.report-card-heading {
  gap: 0.7rem;
}

.report-title-group {
  min-width: 0;
  flex: 1;
}

.report-title-group h3 {
  margin: 0;
  color: var(--app-text);
  font-size: 0.88rem;
  font-weight: 700;
}

.report-icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--app-primary) 14%, transparent);
  color: var(--app-primary);
}

.report-periodicity,
.report-meta-label {
  color: var(--app-text-muted);
  font-size: 0.7rem;
}

.report-period {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--app-border, rgba(148, 163, 184, 0.14));
  border-bottom: 1px solid var(--app-border, rgba(148, 163, 184, 0.14));
}

.report-period strong {
  color: var(--app-text);
  font-size: 0.82rem;
}

.report-card-footer {
  justify-content: space-between;
  gap: 0.75rem;
}

.report-meta {
  flex-wrap: wrap;
  gap: 0.5rem;
  color: var(--app-text-muted);
  font-size: 0.68rem;
}

.report-format {
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-primary) 12%, transparent);
  color: var(--app-primary);
  font-weight: 700;
}

.reports-empty {
  padding: 2rem 1rem;
  color: var(--app-text-muted);
  text-align: center;
}

.secondary-text {
  color:
    var(--app-text-muted);

  font-size:
    0.69rem;
}


/* SELECT FIX */

.select-host {
  position:
    relative;

  overflow:
    visible;

  isolation:
    isolate;

  z-index:
    10;
}

.select-host :deep(.p-select-overlay) {
  position:
    absolute !important;

  left:
    0 !important;

  right:
    auto !important;

  transform:
    none !important;

  width:
    100% !important;

  min-width:
    100% !important;

  z-index:
    10000 !important;
}

@media (max-width: 900px) {
  .report-form {
    grid-template-columns:
      repeat(2,
        minmax(0,
          1fr));
  }
}

@media (max-width: 600px) {
  .report-form {
    grid-template-columns:
      1fr;
  }
}
</style>
