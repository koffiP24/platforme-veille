<script setup lang="ts">
import {
    computed,
    onMounted,
    ref,
    watch,
} from 'vue';

import Button from 'primevue/button';
import { labelFr, optionsFr } from '../i18n/labels';
import { useToast } from 'primevue/usetoast';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import Checkbox from 'primevue/checkbox';
import CheckCircleIcon from '@primeicons/vue/check-circle';
import CogIcon from '@primeicons/vue/cog';
import ExternalLinkIcon from '@primeicons/vue/external-link';
import PauseCircleIcon from '@primeicons/vue/pause-circle';
import PencilIcon from '@primeicons/vue/pencil';
import PlayCircleIcon from '@primeicons/vue/play-circle';
import PlusIcon from '@primeicons/vue/plus';
import SearchIcon from '@primeicons/vue/search';
import UploadIcon from '@primeicons/vue/upload';
import { isAxiosError } from 'axios';
import { buildConnectorConfig } from '../services/connector-config';
import { defaultSourceQuery } from '../utils/source-targeting';
import { safeExternalUrl } from '../utils/safe-external-url';

import AppLayout from '../layouts/AppLayout.vue';
import { useAuthStore } from '../stores/auth';
import { getWatchItems, type WatchItem } from '../services/watch-items.service';
import { actionError, actionSuccess } from '../utils/action-toast';
import { statusSeverity } from '../utils/status-severity';

import {
    createSource,
    createConnector,
    updateSource,
    updateSourceStatus,
    getSources,
    testConnector,
    runConnector,
    importManualSource,
    type Source,
} from '../services/sources.service';

const auth = useAuthStore();
const CROSSREF_API_URL = 'https://api.crossref.org';
const canCreateSource = computed(() => {
    const roles = auth.user?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('OPERATEUR_VEILLE');
});
const canChangeStatus = computed(() => Boolean(auth.isAdmin));
const canEditSource = computed(() => Boolean(auth.isAdmin));
const canTestConnector = computed(() => Boolean(auth.isAdmin));
const canRunConnector = computed(() => {
    const roles = auth.user?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('RESPONSABLE_VEILLE');
});
const canImportManual = computed(() => {
    const roles = auth.user?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('RESPONSABLE_VEILLE') || roles.includes('OPERATEUR_VEILLE');
});

const sources = ref<Source[]>([]);
const loading = ref(false);
const feedItems = ref<WatchItem[]>([]);
const feedLoading = ref(false);
const sourceSearch = ref('');
const sourceTableFirst = ref(0);

function normalizeSearchValue(value: unknown): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('fr-FR');
}

const sourceRows = computed(() => {
    const latestBySource = new Map<number, WatchItem>();

    for (const item of feedItems.value) {
        const current = latestBySource.get(item.source.id);
        const itemDate = new Date(item.publishedAt ?? item.collectedAt).getTime();
        const currentDate = current
            ? new Date(current.publishedAt ?? current.collectedAt).getTime()
            : Number.NEGATIVE_INFINITY;

        if (!current || itemDate > currentDate) latestBySource.set(item.source.id, item);
    }

    const rows = sources.value.map((source) => {
        const latest = latestBySource.get(source.id);
        return {
            ...source,
            latestTitle: latest?.title ?? 'Aucune publication collectée',
            latestPublishedAt: latest?.publishedAt ?? null,
            latestSummary: latest?.summary ?? 'Aucun résumé disponible.',
            externalUrl: latest?.url ?? source.baseUrl,
        };
    });

    const query = normalizeSearchValue(sourceSearch.value.trim());
    if (!query) return rows;

    return rows.filter((source) =>
        [
            source.name,
            source.organization,
            source.country,
            source.category,
            source.sourceType,
            source.latestTitle,
            source.latestSummary,
        ].some((value) => normalizeSearchValue(value).includes(query)),
    );
});

watch(sourceSearch, () => {
    sourceTableFirst.value = 0;
});

const dialogVisible = ref(false);
const error = ref('');
const statusError = ref('');
const changingStatus = ref<number[]>([]);
const busyConnectors = ref<number[]>([]);
const collectingConnectors = ref<number[]>([]);
const createWithConnector = ref(true);
const submitting = ref(false);
const editDialogVisible = ref(false);
const editingSource = ref<Source | null>(null);
const editError = ref('');
const editSubmitting = ref(false);
const crossrefQuery = ref('');
const connectorDialog = ref(false);
const selectedSource = ref<Source | null>(null);
const connectorUrl = ref('');
const connectorQuery = ref('');
const connectorError = ref('');
const savingConnector = ref(false);
const importDialogVisible = ref(false);
const importSource = ref<Source | null>(null);
const importFile = ref<File | null>(null);
const importError = ref('');
const importing = ref(false);
const toast = useToast();

function openManualImport(source: Source) {
    importSource.value = source;
    importFile.value = null;
    importError.value = '';
    importDialogVisible.value = true;
}

function selectImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    importError.value = '';
    const selected = input.files?.[0] ?? null;
    if (selected && selected.size > 5 * 1024 * 1024) {
        importFile.value = null;
        input.value = '';
        importError.value = 'Le fichier dépasse la taille maximale de 5 Mo.';
        return;
    }
    importFile.value = selected;
}

function downloadImportTemplate() {
    const content = '\uFEFFtitre;resume;url;date_publication;doi;identifiant;langue\r\n' +
        'Exemple de publication;Résumé de la publication;https://exemple.org/publication;22/09/2026;;;fr\r\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-import-veille.csv';
    link.click();
    URL.revokeObjectURL(url);
}

async function submitManualImport() {
    if (!importSource.value || !importFile.value || importing.value) return;
    importing.value = true;
    importError.value = '';
    try {
        const result = (await importManualSource(importSource.value.id, importFile.value)).data;
        importDialogVisible.value = false;
        await Promise.all([loadSources(), loadFeedItems()]);
        toast.add({
            severity: result.errors ? 'warn' : 'success',
            summary: result.errors ? 'Import terminé avec erreurs' : 'Import terminé',
            detail: `${result.received} ligne(s) reçue(s) · ${result.created} créée(s) · ${result.updated} mise(s) à jour · ${result.duplicates} doublon(s) · ${result.errors} erreur(s)`,
            life: 12000,
        });
    } catch (cause) {
        importError.value = errorMessage(cause);
        actionError(toast, cause, 'Import impossible', importError.value);
    } finally {
        importing.value = false;
    }
}

const publicationDateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

function formatPublicationDate(value: string | null): string {
    if (!value) return 'Non renseignée';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Non renseignée' : publicationDateFormatter.format(date);
}

function errorMessage(err: unknown): string {
    if (isAxiosError(err)) {
        const message = err.response?.data?.message;
        if (Array.isArray(message)) return message.join(' ');
        if (typeof message === 'string') return message;
    }
    return err instanceof Error ? err.message : 'Une erreur est survenue.';
}

function configure(source: Source) {
    if (!auth.isAdmin) return;
    selectedSource.value = source;
    connectorUrl.value = source.baseUrl || (source.sourceType === 'API' ? CROSSREF_API_URL : '');
    connectorQuery.value = defaultSourceQuery(source.category);
    connectorError.value = '';
    connectorDialog.value = true;
}

async function saveConnector() {
    if (!auth.isAdmin || !selectedSource.value || savingConnector.value) return;
    savingConnector.value = true;
    connectorError.value = '';
    try {
        const source = selectedSource.value;
        const config = buildConnectorConfig(source.sourceType, connectorUrl.value, connectorQuery.value);
        // Rafraîchir avant de créer pour éviter un doublon après une réponse perdue.
        await loadSources();
        if (!sources.value.find((item) => item.id === source.id)?.connectors?.length) {
            await createConnector(source.id, source.sourceType, config);
        }
        connectorDialog.value = false;
        await loadSources();
        actionSuccess(toast, 'Connecteur configuré', `Le connecteur de la source « ${source.name} » est prêt.`);
    } catch (err: unknown) {
        connectorError.value = errorMessage(err);
        actionError(toast, err, 'Configuration impossible', 'Le connecteur n’a pas pu être configuré.');
        if (!connectorDialog.value) statusError.value = 'Connecteur créé, mais actualisation impossible. Rechargez la page.';
    } finally {
        savingConnector.value = false;
    }
}

const categoryOptions = [
    'SCIENTIFIQUE',
    'REGLEMENTAIRE',
    'ACCREDITATION',
    'NORMATIF',
    'ENVIRONNEMENT',
    'AUTRE',
];

const sourceTypeOptions = [
    'API',
    'RSS',
    'ATOM',
    'IMPORT_MANUEL',
];

const form = ref({
    name: '',
    organization: '',
    country: '',
    category: '',
    sourceType: '',
    baseUrl: '',
    frequency: '',
    active: true,
});

const editForm = ref({
    name: '',
    organization: '',
    country: '',
    category: '',
    sourceType: '',
    baseUrl: '',
    frequency: '',
    active: true,
});

function applyManualSourceDefaults(sourceType: unknown) {
    const value = typeof sourceType === 'string'
        ? sourceType
        : (sourceType as { value?: string } | null)?.value;
    if (value !== 'IMPORT_MANUEL') return;
    form.value.baseUrl = '';
    form.value.frequency = '';
    if (!form.value.name.trim()) form.value.name = 'Import manuel';
    if (!form.value.category) form.value.category = 'AUTRE';
}

watch(() => form.value.sourceType, (sourceType, previousType) => {
    if (sourceType === 'API') form.value.baseUrl = CROSSREF_API_URL;
    else if (sourceType === 'IMPORT_MANUEL') {
        applyManualSourceDefaults(sourceType);
    }
    else if (previousType === 'API' && form.value.baseUrl === CROSSREF_API_URL) form.value.baseUrl = '';
});

watch(() => form.value.category, (category) => {
    crossrefQuery.value = defaultSourceQuery(category);
});

watch(() => editForm.value.sourceType, (sourceType, previousType) => {
    if (sourceType === 'API') editForm.value.baseUrl = CROSSREF_API_URL;
    else if (sourceType === 'IMPORT_MANUEL') {
        editForm.value.baseUrl = '';
        editForm.value.frequency = '';
    }
    else if (previousType === 'API' && editForm.value.baseUrl === CROSSREF_API_URL) editForm.value.baseUrl = '';
});

function openEditDialog(source: Source) {
    if (!canEditSource.value) return;
    editingSource.value = source;
    editError.value = '';
    editForm.value = {
        name: source.name,
        organization: source.organization ?? '',
        country: source.country ?? '',
        category: source.category,
        sourceType: getSourceType(source),
        baseUrl: source.baseUrl ?? '',
        frequency: source.frequency ?? '',
        active: source.active,
    };
    editDialogVisible.value = true;
}

/** Accepte aussi l'ancien nom SQL renvoyé par certains déploiements de l'API. */
function getSourceType(source: Source): string {
    const legacySource = source as Source & { source_type?: string };
    return source.sourceType || legacySource.source_type || source.connectors?.[0]?.connectorType || '';
}

async function submitEdit() {
    const source = editingSource.value;
    if (!canEditSource.value || !source || editSubmitting.value) return;
    editSubmitting.value = true;
    editError.value = '';

    try {
        const response = await updateSource(source.id, {
            name: editForm.value.name.trim(),
            organization: editForm.value.organization.trim() || undefined,
            country: editForm.value.country.trim() || undefined,
            category: editForm.value.category,
            sourceType: editForm.value.sourceType,
            baseUrl: editForm.value.baseUrl.trim() || undefined,
            frequency: editForm.value.frequency.trim() || undefined,
            active: editForm.value.active,
        });
        editDialogVisible.value = false;
        editingSource.value = null;
        await Promise.all([loadSources(), loadFeedItems()]);
        actionSuccess(toast, 'Source modifiée', `La source « ${response.data.name} » a été mise à jour.`);
    } catch (err: unknown) {
        editError.value = errorMessage(err);
        actionError(toast, err, 'Modification impossible', 'La source n’a pas pu être modifiée.');
    } finally {
        editSubmitting.value = false;
    }
}

async function loadSources() {
    loading.value = true;

    try {
        const response =
            await getSources();

        sources.value = response.data.map((source) => ({
            ...source,
            sourceType: getSourceType(source),
        }));
    } finally {
        loading.value = false;
    }
}

async function loadFeedItems() {
    feedLoading.value = true;
    try {
        feedItems.value = (await getWatchItems()).data;
    } catch (err: unknown) {
        statusError.value = errorMessage(err);
    } finally {
        feedLoading.value = false;
    }
}

async function submit() {
    if (!canCreateSource.value || submitting.value) return;
    error.value = '';
    statusError.value = '';
    submitting.value = true;

    try {
        const config = auth.isAdmin && createWithConnector.value && form.value.sourceType !== 'IMPORT_MANUEL'
            ? buildConnectorConfig(form.value.sourceType, form.value.baseUrl, crossrefQuery.value)
            : null;
        const response = await createSource({
            ...form.value,
            baseUrl: form.value.baseUrl.trim() || undefined,
        });

        dialogVisible.value = false;

        if (config) {
            try {
                await createConnector(response.data.id, response.data.sourceType, config);
            } catch (err: unknown) {
                statusError.value = `Source créée (#${response.data.id}), mais connecteur non confirmé : ${errorMessage(err)} Utilisez « Configurer » après actualisation.`;
                toast.add({
                    severity: 'warn',
                    summary: 'Source créée sans connecteur',
                    detail: statusError.value,
                    life: 8000,
                });
            }
        }
        crossrefQuery.value = '';

        form.value = {
            name: '',
            organization: '',
            country: '',
            category: '',
            sourceType: '',
            baseUrl: '',
            frequency: '',
            active: true,
        };

        await loadSources();
        actionSuccess(toast, 'Source créée', `La source « ${response.data.name} » a été enregistrée.`);
    } catch (err: unknown) {
        if (dialogVisible.value) error.value = errorMessage(err);
        else statusError.value = 'Source créée, mais actualisation impossible. Rechargez la page.';
        actionError(toast, err, 'Création impossible', 'La source n’a pas pu être créée.');
    } finally {
        submitting.value = false;
    }
}

async function changeStatus(id: number, active: boolean) {
    if (!canChangeStatus.value) return;
    if (changingStatus.value.includes(id)) return;
    statusError.value = '';
    changingStatus.value.push(id);
    try {
        const response = await updateSourceStatus(id, active);
        const source = sources.value.find((item) => item.id === id);
        if (source) source.active = response.data.active;
        actionSuccess(
            toast,
            active ? 'Source réactivée' : 'Source désactivée',
            active ? 'La collecte peut de nouveau utiliser cette source.' : 'Cette source ne sera plus collectée.',
        );
    } catch (err: unknown) {
        statusError.value = 'Impossible de modifier le statut de la source. Réessaie.';
        actionError(toast, err, 'Modification impossible', statusError.value);
    } finally {
        changingStatus.value = changingStatus.value.filter((item) => item !== id);
    }
}

async function test(connectorId: number) {
    if (!canTestConnector.value) return;
    if (busyConnectors.value.includes(connectorId)) return;
    busyConnectors.value.push(connectorId);
    try {
        const response = await testConnector(connectorId);
        toast.add({
            severity: response.data.success ? 'success' : 'error',
            summary: 'Résultat du test du connecteur',
            detail: response.data.message,
            life: 8000,
        });
        try {
            await Promise.all([loadSources(), loadFeedItems()]);
        } catch {
            statusError.value = 'Impossible d’actualiser les sources. Rechargez la page.';
        }
    } catch {
        toast.add({ severity: 'error', summary: 'Test échoué', detail: 'Échec du test du connecteur.', life: 8000 });
    } finally {
        busyConnectors.value = busyConnectors.value.filter((id) => id !== connectorId);
    }
}

async function run(connectorId: number) {
    if (!canRunConnector.value) return;
    if (busyConnectors.value.includes(connectorId)) return;
    busyConnectors.value.push(connectorId);
    collectingConnectors.value.push(connectorId);
    try {
        const response = await runConnector(connectorId);
        const result = response.data;
        if ('message' in result) {
            toast.add({ severity: 'info', summary: 'Collecte en cours', detail: result.message, life: 8000 });
        } else {
            toast.add({
                severity: result.errors > 0 ? 'warn' : 'success',
                summary: result.errors > 0 ? 'Collecte terminée avec erreurs' : 'Collecte terminée',
                detail: `${result.received} reçus\n${result.created} nouveaux\n` +
                    `${result.updated} mis à jour\n${result.duplicates} doublons\n${result.errors} erreur(s)`,
                life: 12000,
            });
        }
        try {
            await Promise.all([loadSources(), loadFeedItems()]);
        } catch {
            statusError.value = 'Impossible d’actualiser les sources. Rechargez la page.';
        }
    } catch (err: unknown) {
        toast.add({
            severity: 'error',
            summary: 'Collecte échouée',
            detail: errorMessage(err),
            life: 10000,
        });
    } finally {
        collectingConnectors.value = collectingConnectors.value.filter((id) => id !== connectorId);
        busyConnectors.value = busyConnectors.value.filter((id) => id !== connectorId);
    }
}

onMounted(() => {
    void Promise.allSettled([loadSources(), loadFeedItems()]);
});
</script>

<template>
    <AppLayout>
        <div class="space-y-6">
            <div>
                <div>
                    <h2 class="text-2xl font-bold text-slate-900">
                        Sources
                    </h2>

                    <p class="text-slate-700">
                        Référentiel des sources
                        de veille.
                    </p>
                </div>
            </div>

            <Message v-if="statusError" severity="error">{{ statusError }}</Message>

            <div class="rounded-xl bg-white p-3 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div class="relative min-w-0 flex-1">
                        <SearchIcon
                            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size="0.95rem" />
                        <InputText v-model="sourceSearch" class="w-full !pl-10"
                            placeholder="Rechercher un flux, un titre ou un résumé..." />
                    </div>
                    <Button v-if="canCreateSource" label="Ajouter une source" class="shrink-0"
                        @click="dialogVisible = true">
                        <template #icon><PlusIcon size="0.9rem" /></template>
                    </Button>
                </div>
            </div>

            <div class="rounded-xl bg-white p-3 shadow-sm">
                <p class="mb-3 text-xs leading-5 text-slate-500">
                    L’état affiché ici concerne la disponibilité de la source et de sa collecte automatique.
                    Le statut d’une veille se consulte dans « Veilles » : une action de suivi peut être créée uniquement
                    lorsqu’elle est à qualifier, validée ou publiée.
                </p>
                <DataTable class="compact-table" :value="sourceRows" :loading="loading || feedLoading" paginator
                    :first="sourceTableFirst" :rows="10" @page="sourceTableFirst = $event.first">
                    <template #empty>
                        {{ sourceSearch.trim() ? 'Aucune source ne correspond à la recherche.' : 'Aucune source enregistrée.' }}
                    </template>
                    <Column field="name" header="Flux" style="width: 13rem">
                        <template #body="{ data }">
                            <span class="font-medium text-slate-800">{{ data.name }}</span>
                        </template>
                    </Column>
                    <Column field="latestTitle" header="Titre" style="min-width: 17rem">
                        <template #body="{ data }">
                            <span class="font-semibold leading-5 text-slate-900">{{ data.latestTitle }}</span>
                        </template>
                    </Column>
                    <Column header="Publication" style="width: 10rem">
                        <template #body="{ data }">{{ formatPublicationDate(data.latestPublishedAt) }}</template>
                    </Column>
                    <Column header="Résumé" style="min-width: 24rem">
                        <template #body="{ data }">
                            <p class="source-summary">{{ data.latestSummary }}</p>
                        </template>
                    </Column>
                    <Column header="État de la source" style="width: 11rem">
                        <template #body="{ data }">
                            <div class="flex flex-col items-start gap-1.5">
                                <Tag :value="data.active ? 'Source active' : 'Source inactive'"
                                    :severity="data.active ? 'success' : 'secondary'" />
                                <Tag v-if="data.sourceType === 'IMPORT_MANUEL'" value="Import manuel" severity="info" />
                                <Tag v-else-if="data.connectors?.length" :value="labelFr(data.connectors[0].status)"
                                    :severity="statusSeverity(data.connectors[0].status)" />
                                <span v-else class="text-xs text-slate-500">Sans collecte automatique</span>
                            </div>
                        </template>
                    </Column>
                    <Column header="Actions">
                        <template #body="{ data }">
                            <div class="source-actions">
                                <Button v-if="canEditSource" aria-label="Modifier" title="Modifier la source"
                                    severity="secondary" size="small" rounded @click="openEditDialog(data)">
                                    <template #icon><PencilIcon size="0.9rem" /></template>
                                </Button>
                                <Button v-if="auth.isAdmin && data.sourceType !== 'IMPORT_MANUEL' && !data.connectors?.length"
                                    aria-label="Configurer" title="Configurer" severity="secondary" size="small" rounded
                                    @click="configure(data)">
                                    <template #icon><CogIcon size="0.9rem" /></template>
                                </Button>
                                <Button v-if="canImportManual && data.active && data.sourceType === 'IMPORT_MANUEL'"
                                    aria-label="Importer un fichier" title="Importer un fichier PDF, CSV ou XLSX"
                                    severity="secondary" size="small" rounded @click="openManualImport(data)">
                                    <template #icon><UploadIcon size="0.9rem" /></template>
                                </Button>
                                <Button v-if="canTestConnector && data.sourceType !== 'IMPORT_MANUEL' && data.connectors?.length"
                                    aria-label="Tester" title="Vérifier le connecteur sans lancer de collecte" size="small" rounded
                                    severity="secondary" :disabled="busyConnectors.includes(data.connectors[0].id)"
                                    @click="test(data.connectors[0].id)">
                                    <template #icon><CheckCircleIcon size="0.9rem" /></template>
                                </Button>
                                <Button v-if="canRunConnector && data.active && data.sourceType !== 'IMPORT_MANUEL' && data.connectors?.length"
                                    :label="collectingConnectors.includes(data.connectors[0].id) ? 'Collecte…' : 'Collecter'"
                                    size="small"
                                    :loading="collectingConnectors.includes(data.connectors[0].id)"
                                    :disabled="busyConnectors.includes(data.connectors[0].id)"
                                    @click="run(data.connectors[0].id)">
                                    <template #icon><i class="pi pi-sync" aria-hidden="true" /></template>
                                </Button>
                                <Button v-if="canChangeStatus && data.active"
                                    aria-label="Désactiver" title="Désactiver" severity="danger" size="small" rounded
                                    :loading="changingStatus.includes(data.id)"
                                    :disabled="changingStatus.includes(data.id)"
                                    @click="changeStatus(data.id, false)">
                                    <template #icon><PauseCircleIcon size="0.9rem" /></template>
                                </Button>
                                <Button v-if="canChangeStatus && !data.active"
                                    aria-label="Réactiver" title="Réactiver" severity="success" size="small" rounded
                                    :loading="changingStatus.includes(data.id)"
                                    :disabled="changingStatus.includes(data.id)" @click="changeStatus(data.id, true)">
                                    <template #icon><PlayCircleIcon size="0.9rem" /></template>
                                </Button>
                                <Button v-if="safeExternalUrl(data.externalUrl)" as="a" :href="safeExternalUrl(data.externalUrl)" target="_blank"
                                    rel="noopener noreferrer" aria-label="Ouvrir la source"
                                    title="Ouvrir la source dans un nouvel onglet" severity="secondary" size="small" rounded>
                                    <template #icon><ExternalLinkIcon size="0.9rem" /></template>
                                </Button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <Dialog v-model:visible="importDialogVisible" modal header="Importer des éléments de veille"
                class="w-full max-w-xl" :closable="!importing" :close-on-escape="!importing">
                <form class="space-y-4" @submit.prevent="submitManualImport">
                    <p class="text-sm text-slate-600">
                        Source : <strong>{{ importSource?.name }}</strong>
                    </p>
                    <Message v-if="importError" severity="error">{{ importError }}</Message>
                    <Message severity="info">
                        Formats acceptés : PDF, CSV et XLSX, 5 Mo maximum. Pour un PDF, chaque veille doit respecter le modèle titre, résumé, URL et date séparés par une ligne vide.
                    </Message>
                    <div>
                        <label for="manual-import-file" class="required-label mb-2 block font-medium">Fichier à importer</label>
                        <input id="manual-import-file" type="file" accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-medium"
                            :disabled="importing" required @change="selectImportFile" />
                    </div>
                    <div class="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                        <p><strong>Colonne obligatoire :</strong> titre.</p>
                        <p><strong>Colonnes facultatives :</strong> resume, url, date_publication, doi, identifiant et langue.</p>
                        <p class="mt-1 text-xs">Dates acceptées : 22/09/2026 ou 2026-09-22.</p>
                    </div>
                    <div class="flex flex-wrap justify-between gap-3">
                        <Button type="button" label="Télécharger le modèle CSV" severity="secondary" text
                            :disabled="importing" @click="downloadImportTemplate" />
                        <div class="flex gap-3">
                            <Button type="button" label="Annuler" severity="secondary" :disabled="importing"
                                @click="importDialogVisible = false" />
                            <Button type="submit" label="Importer le fichier" :loading="importing"
                                :disabled="!importFile || importing">
                                <template #icon><UploadIcon size="0.9rem" /></template>
                            </Button>
                        </div>
                    </div>
                </form>
            </Dialog>

            <Dialog v-if="canEditSource" v-model:visible="editDialogVisible" modal header="Modifier la source"
                class="w-full max-w-2xl" :closable="!editSubmitting" :close-on-escape="!editSubmitting">
                <form class="space-y-4" @submit.prevent="submitEdit">
                    <Message v-if="editError" severity="error">{{ editError }}</Message>

                    <div>
                        <label for="edit-source-type" class="required-label mb-2 block">Type de source (non modifiable)</label>
                        <InputText id="edit-source-type" :model-value="labelFr(editForm.sourceType)"
                            class="w-full" readonly aria-readonly="true" tabindex="-1" />
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label for="edit-source-name" class="required-label mb-2 block">Nom</label>
                            <InputText id="edit-source-name" v-model="editForm.name" class="w-full" required
                                :disabled="editSubmitting" />
                        </div>
                        <div>
                            <label for="edit-source-organization" class="mb-2 block">Organisme</label>
                            <InputText id="edit-source-organization" v-model="editForm.organization" class="w-full"
                                :disabled="editSubmitting" />
                        </div>
                        <div>
                            <label for="edit-source-country" class="mb-2 block">Pays</label>
                            <InputText id="edit-source-country" v-model="editForm.country" class="w-full"
                                :disabled="editSubmitting" />
                        </div>
                        <div>
                            <label for="edit-source-category" class="required-label mb-2 block">Catégorie</label>
                            <div class="select-host">
                              <Select append-to="self" id="edit-source-category" v-model="editForm.category" :options="optionsFr(categoryOptions)"
                                option-label="label" option-value="value" class="w-full" required
                                :disabled="editSubmitting" />
                            </div>
                        </div>
                        <div v-if="editForm.sourceType !== 'IMPORT_MANUEL'">
                            <label for="edit-source-frequency" class="mb-2 block">Fréquence</label>
                            <InputText id="edit-source-frequency" v-model="editForm.frequency" class="w-full"
                                placeholder="Ex. : 30m, 6h ou 1j" :disabled="editSubmitting" />
                        </div>
                    </div>

                    <div v-if="editForm.sourceType !== 'IMPORT_MANUEL'">
                        <label for="edit-source-url" class="mb-2 block">URL</label>
                        <InputText id="edit-source-url" v-model="editForm.baseUrl" class="w-full"
                            :disabled="editSubmitting || Boolean(editingSource?.connectors?.length)" />
                        <p v-if="editForm.sourceType === 'API' && !editingSource?.connectors?.length" class="mt-1 text-xs text-slate-500">
                            L’URL doit pointer vers une API publique qui renvoie directement du JSON contenant une liste d’articles.
                        </p>
                        <p v-if="editingSource?.connectors?.length" class="mt-1 text-xs text-slate-500">
                            L’URL appartient à la configuration du connecteur associé.
                        </p>
                    </div>

                    <div class="flex justify-end gap-3">
                        <Button type="button" label="Annuler" severity="secondary" :disabled="editSubmitting"
                            @click="editDialogVisible = false" />
                        <Button type="submit" label="Enregistrer les modifications" :loading="editSubmitting"
                            :disabled="editSubmitting" />
                    </div>
                </form>
            </Dialog>

            <Dialog v-if="auth.isAdmin" v-model:visible="connectorDialog" modal header="Configurer la collecte"
                class="w-full max-w-xl" :closable="!savingConnector" :close-on-escape="!savingConnector">
                <form class="space-y-4" @submit.prevent="saveConnector">
                    <p>{{ selectedSource?.name }} — {{ labelFr(selectedSource?.sourceType) }}</p>
                    <Message v-if="connectorError" severity="error">{{ connectorError }}</Message>
                    <Message v-if="selectedSource?.sourceType === 'API'" severity="info">
                        Crossref est pris en charge. Les autres API publiques doivent renvoyer du JSON contenant une liste d’articles.
                    </Message>
                    <Message v-if="selectedSource?.sourceType === 'IMPORT_MANUEL'" severity="info">
                        L’import manuel ne lance aucune collecte automatique.
                    </Message>
                    <div v-if="selectedSource?.sourceType !== 'IMPORT_MANUEL'">
                        <label for="connector-url" class="required-label mb-2 block">Adresse du flux ou de l’API</label>
                        <InputText id="connector-url" v-model="connectorUrl" class="w-full" required
                            :disabled="savingConnector" />
                        <p v-if="selectedSource?.sourceType === 'API'" class="mt-1 text-xs text-slate-500">
                            Utilisez l’URL directe de l’API, pas une page HTML. Les listes dans « items », « results », « data », « articles » ou « hydra:member » sont reconnues.
                        </p>
                    </div>
                    <div v-if="selectedSource?.sourceType === 'API'">
                        <label for="connector-query" class="mb-2 block">Sujet à surveiller</label>
                        <InputText id="connector-query" v-model="connectorQuery" class="w-full" placeholder="Ex. : environnement, ISO 17025, bonbon sucré salé"
                            :disabled="savingConnector" />
                        <p class="mt-1 text-sm text-slate-500">
                            Facultatif. Séparez les sujets par des virgules ; aucun guillemet n’est nécessaire.
                        </p>
                    </div>
                    <Button type="submit" label="Enregistrer le connecteur" :loading="savingConnector"
                        :disabled="savingConnector" />
                </form>
            </Dialog>

            <Dialog v-if="canCreateSource" v-model:visible="dialogVisible
                " modal header="Nouvelle source" class="w-full max-w-2xl" :closable="!submitting" :close-on-escape="!submitting">
                <form class="space-y-4" @submit.prevent="submit">
                    <Message v-if="error" severity="error">
                        {{ error }}
                    </Message>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="required-label mb-2 block">
                                Nom
                            </label>

                            <InputText v-model="form.name" class="w-full" required />
                        </div>

                        <div>
                            <label class="mb-2 block">
                                Organisme
                            </label>

                            <InputText v-model="form.organization
                                " class="w-full" />
                        </div>

                        <div>
                            <label class="mb-2 block">
                                Pays
                            </label>

                            <InputText v-model="form.country
                                " class="w-full" />
                        </div>

                        <div>
                            <label class="required-label mb-2 block">
                                Catégorie
                            </label>

                            <div class="select-host">
                              <Select append-to="self" v-model="form.category
                                " option-label="label" option-value="value" :options="optionsFr(categoryOptions)
                                    " class="w-full" required />
                            </div>
                        </div>

                        <div>
                            <label class="required-label mb-2 block">
                                Type
                            </label>

                            <div class="select-host">
                              <Select append-to="self" v-model="form.sourceType
                                " option-label="label" option-value="value" :options="optionsFr(sourceTypeOptions)
                                    " class="w-full" required @update:model-value="applyManualSourceDefaults" @change="(event) => applyManualSourceDefaults(event.value)" />
                            </div>
                        </div>

                        <div v-if="form.sourceType !== 'IMPORT_MANUEL'">
                            <label class="mb-2 block">
                                Fréquence
                            </label>

                            <InputText v-model="form.frequency
                                " class="w-full" placeholder="Ex. : 30m, 6h ou 1j" />
                            <p class="mt-1 text-sm text-slate-500">m : minutes · h : heures · j : jours</p>
                        </div>
                    </div>

                    <div v-if="form.sourceType !== 'IMPORT_MANUEL'">
                        <label class="mb-2 block" :class="{ 'required-label': createWithConnector && form.sourceType !== 'IMPORT_MANUEL' }">
                            Adresse de la source
                        </label>

                        <InputText v-model="form.baseUrl
                            " class="w-full" placeholder="https://…"
                            :required="createWithConnector && form.sourceType !== 'IMPORT_MANUEL'" />
                        <p v-if="form.sourceType === 'API'" class="mt-1 text-sm text-slate-500">
                            Crossref est pris en charge. Pour une autre API publique, utilisez son URL directe JSON avec une liste d’articles ; une page HTML ne convient pas.
                        </p>
                    </div>

                    <div v-if="auth.isAdmin" class="space-y-3">
                        <div class="flex items-center gap-2">
                            <Checkbox v-if="form.sourceType !== 'IMPORT_MANUEL'" v-model="createWithConnector" input-id="with-connector" binary />
                            <label v-if="form.sourceType !== 'IMPORT_MANUEL'" for="with-connector">Créer aussi le connecteur de collecte</label>
                        </div>
                        <Message v-if="form.sourceType === 'IMPORT_MANUEL'" severity="info">
                            Après la création, utilisez le bouton d’import dans la ligne de la source pour sélectionner un fichier PDF, CSV ou XLSX.
                        </Message>
                        <p v-if="createWithConnector && ['RSS', 'ATOM'].includes(form.sourceType)"
                            class="text-sm text-slate-500">
                            Utilisez l’adresse du flux, pas celle de la page d’accueil. Le format XML, JSON ou CSV est détecté automatiquement.
                        </p>
                        <div v-if="createWithConnector && form.sourceType === 'API'">
                            <p class="mb-2 text-sm text-slate-500">Les API publiques qui renvoient une liste JSON d’articles sont prises en charge. Les API nécessitant une clé ou une configuration spéciale ne le sont pas encore.</p>
                            <label for="source-query" class="mb-2 block">Sujet à surveiller</label>
                            <InputText id="source-query" v-model="crossrefQuery" class="w-full" placeholder="Ex. : environnement, ISO 17025, bonbon sucré salé" />
                            <p class="mt-1 text-sm text-slate-500">
                                Séparez les sujets par des virgules. Une expression de plusieurs mots ne nécessite pas de guillemets.
                            </p>
                        </div>
                    </div>
                    <Message v-else severity="info">Un administrateur devra configurer le connecteur pour permettre la
                        collecte.
                    </Message>

                    <div class="flex justify-end gap-3">
                        <Button type="button" label="Annuler" severity="secondary" :disabled="submitting" @click="
                            dialogVisible = false
                            " />

                        <Button type="submit" label="Créer la source" :loading="submitting" :disabled="submitting" />
                    </div>
                </form>
            </Dialog>
        </div>
    </AppLayout>
</template>

<style scoped>
.source-actions {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
}

.source-actions :deep(.p-button) {
    min-height: 1.8rem;
    font-size: 0.75rem;
}

.source-summary {
    display: -webkit-box;
    overflow: hidden;
    color: var(--app-text-secondary);
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
</style>
