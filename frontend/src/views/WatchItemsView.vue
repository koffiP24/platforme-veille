<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import {
  useRoute,
  useRouter,
} from 'vue-router';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

import {
  useToast,
} from 'primevue/usetoast';

import PlusIcon from '@primeicons/vue/plus';
import ArrowRightIcon from '@primeicons/vue/arrow-right';
import BookmarkIcon from '@primeicons/vue/bookmark';
import CheckCircleIcon from '@primeicons/vue/check-circle';
import ExternalLinkIcon from '@primeicons/vue/external-link';
import StarIcon from '@primeicons/vue/star';
import StarFillIcon from '@primeicons/vue/star-fill';
import TrashIcon from '@primeicons/vue/trash';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';
import SourceTypeBadge from '../components/ui/SourceTypeBadge.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import { safeExternalUrl } from '../utils/safe-external-url';

import {
  errorFr,
} from '../i18n/errors';

import {
  labelFr,
  optionsFr,
} from '../i18n/labels';

import {
  useAuthStore,
} from '../stores/auth';

import {
  searchWatchItems,
  type SearchParams,
} from '../services/search.service';

import {
  addFavorite,
  getFavorites,
  removeFavorite,
} from '../services/favorites.service';

import {
  createSavedView,
  deleteSavedView,
  getSavedViews,
} from '../services/saved-views.service';

import type {
  WatchItem,
} from '../services/watch-items.service';

import {
  createSource,
  createConnector,
} from '../services/sources.service';

import {
  buildConnectorConfig,
} from '../services/connector-config';

import {
  defaultSourceQuery,
} from '../utils/source-targeting';


const router =
  useRouter();

const route =
  useRoute();

const auth =
  useAuthStore();

const toast =
  useToast();

function queryValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function queryNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(queryValue(value));
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function querySortOrder(value: unknown): 'ASC' | 'DESC' {
  return queryValue(value, 'DESC') === 'ASC' ? 'ASC' : 'DESC';
}

const sortableFields = new Set([
  'publishedAt',
  'collectedAt',
  'relevance',
  'criticality',
  'title',
  'sourceName',
  'sourceType',
  'summary',
  'status',
]);

function querySortBy(value: unknown): string {
  const field = queryValue(value, 'collectedAt');
  return sortableFields.has(field) ? field : 'collectedAt';
}

const initialListQuery = route.query;


const sourceDialogVisible =
  ref(false);

const sourceSubmitting =
  ref(false);

const sourceError =
  ref('');

const createWithConnector =
  ref(true);

const targetQuery =
  ref('');

const CROSSREF_API_URL =
  'https://api.crossref.org';


const sourceCategoryOptions = [
  'SCIENTIFIQUE',
  'REGLEMENTAIRE',
  'ACCREDITATION',
  'NORMATIF',
  'ENVIRONNEMENT',
  'AUTRE',
];


const sourceCreationTypeOptions = [
  'API',
  'RSS',
  'ATOM',
  'IMPORT_MANUEL',
];


const sourceForm =
  ref({
    name:
      '',

    organization:
      '',

    country:
      '',

    category:
      '',

    sourceType:
      '',

    baseUrl:
      '',

    frequency:
      '',

    active:
      true,
  });


watch(
  () =>
    sourceForm.value.category,

  (category) => {
    targetQuery.value =
      defaultSourceQuery(
        category,
      );
  },
);


watch(
  () =>
    sourceForm.value.sourceType,

  (
    sourceType,
    previousType,
  ) => {
    if (
      sourceType ===
      'API'
    ) {
      sourceForm.value.baseUrl =
        CROSSREF_API_URL;
    } else if (
      sourceType ===
      'IMPORT_MANUEL'
    ) {
      sourceForm.value.baseUrl =
        '';

      sourceForm.value.frequency =
        '';

      targetQuery.value =
        '';
    } else if (
      previousType ===
      'API'
      &&
      sourceForm.value.baseUrl ===
      CROSSREF_API_URL
    ) {
      sourceForm.value.baseUrl =
        '';
    }
  },
);


interface SavedView {
  id:
  number;

  name:
  string;

  filters:
  Partial<SearchParams>;
}


interface WatchItemSearchResponse {
  items:
  WatchItem[];

  total:
  number;

  page:
  number;

  limit:
  number;

  pages:
  number;
}


const sourceRoles =
  computed(
    () =>
      auth.user?.roles
      ??
      [],
  );


const canCreateSource =
  computed(
    () =>
      sourceRoles.value.includes(
        'ADMIN',
      )
      ||
      sourceRoles.value.includes(
        'OPERATEUR_VEILLE',
      ),
  );


async function submitSource() {
  if (
    !canCreateSource.value
    ||
    sourceSubmitting.value
  ) {
    return;
  }

  sourceSubmitting.value =
    true;

  sourceError.value =
    '';

  try {
    const config =
      auth.isAdmin
        &&
        createWithConnector.value
        &&
        sourceForm.value.sourceType !==
        'IMPORT_MANUEL'

        ? buildConnectorConfig(
          sourceForm.value.sourceType,
          sourceForm.value.baseUrl,
          targetQuery.value,
        )

        : null;


    const response =
      await createSource({
        ...sourceForm.value,

        baseUrl:
          sourceForm.value.baseUrl
            .trim()
          ||
          undefined,
      });


    if (
      config
    ) {
      await createConnector(
        response.data.id,
        response.data.sourceType,
        config,
      );
    }


    sourceDialogVisible.value =
      false;


    sourceForm.value = {
      name:
        '',

      organization:
        '',

      country:
        '',

      category:
        '',

      sourceType:
        '',

      baseUrl:
        '',

      frequency:
        '',

      active:
        true,
    };


    targetQuery.value =
      '';


    toast.add({
      severity:
        'success',

      summary:
        'Source créée',

      detail:
        'La source a été enregistrée.',

      life:
        4000,
    });
  } catch (
  cause:
    any
  ) {
    sourceError.value =
      cause.response
        ?.data
        ?.message
      ??
      'Création impossible.';
  } finally {
    sourceSubmitting.value =
      false;
  }
}


const favoritesMode =
  computed(
    () =>
      route.query.favorites ===
      '1',
  );


const pageTitle =
  computed(
    () =>
      favoritesMode.value
        ? 'Mes favoris'
        : 'Éléments de veille',
  );


const pageSubtitle =
  computed(
    () =>
      favoritesMode.value
        ? 'Consultation et recherche dans vos veilles favorites.'
        : 'Recherche, consultation et suivi des informations collectées.',
  );


const items =
  ref<WatchItem[]>([]);

const total =
  ref(0);

const favorites =
  ref<number[]>([]);

const favoriteBusy =
  ref<number[]>([]);

const savedViews =
  ref<SavedView[]>([]);

const saveDialog =
  ref(false);

const viewName =
  ref('');

const viewToDelete =
  ref<SavedView | null>(
    null,
  );

const deletingView =
  ref(false);

const loading =
  ref(false);

const extrasLoading =
  ref(false);

const error =
  ref('');


let searchTimer:
  ReturnType<typeof setTimeout>
  | undefined;

let latestRequest =
  0;

let searchController:
  AbortController
  | undefined;


const filters =
  ref({
    q:
      queryValue(initialListQuery.q),

    status:
      queryValue(initialListQuery.status),

    criticality:
      queryValue(initialListQuery.criticality),

    watchType:
      queryValue(initialListQuery.watchType),

    sourceType:
      queryValue(initialListQuery.sourceType),

    addedOrder:
      querySortOrder(initialListQuery.addedOrder),

    page:
      queryNumber(initialListQuery.page, 1, 1, 100000),

    limit:
      queryNumber(initialListQuery.limit, 20, 1, 100),

    sortBy:
      querySortBy(initialListQuery.sortBy),

    sortOrder:
      querySortOrder(initialListQuery.addedOrder ?? initialListQuery.sortOrder),

    favoritesOnly:
      initialListQuery.favorites ===
      '1',
  });


function listStateQuery() {
  const query: Record<string, string> = {
    page: String(filters.value.page),
    limit: String(filters.value.limit),
    sortBy: filters.value.sortBy,
    sortOrder: filters.value.sortOrder,
    addedOrder: filters.value.addedOrder,
  };

  for (const key of ['q', 'status', 'criticality', 'watchType', 'sourceType'] as const) {
    if (filters.value[key]) query[key] = filters.value[key];
  }

  if (filters.value.favoritesOnly) query.favorites = '1';
  return query;
}


async function openWatchItem(itemId: number | string, qualify = false) {
  await router.replace({ name: 'watch-items', query: listStateQuery() });
  const returnTo = router.currentRoute.value.fullPath;
  await router.push({
    name: qualify ? 'watch-item-qualification' : 'watch-item-detail',
    params: { id: itemId },
    query: { returnTo },
  });
}


const statusOptions =
  optionsFr([
    'NOUVEAU',
    'A_QUALIFIER',
    'VALIDE',
    'PUBLIE',
    'ARCHIVE',
    'REJETE',
  ]);


const criticalityOptions =
  optionsFr([
    'FAIBLE',
    'MOYENNE',
    'ELEVEE',
    'CRITIQUE',
  ]);


const watchTypeOptions =
  optionsFr([
    'SCIENTIFIQUE',
    'REGLEMENTAIRE',
    'ACCREDITATION',
    'NORMATIF',
    'ENVIRONNEMENT',
    'AUTRE',
  ]);


const sourceTypeOptions =
  optionsFr([
    'API',
    'RSS',
    'ATOM',
    'IMPORT_MANUEL',
  ]);


const addedOrderOptions = [
  { label: 'Du plus récent au plus ancien', value: 'DESC' },
  { label: 'Du plus ancien au plus récent', value: 'ASC' },
];


const canQualify =
  computed(() => {
    const roles =
      auth.user?.roles
      ??
      [];

    return (
      roles.includes(
        'ADMIN',
      )
      ||
      roles.includes(
        'RESPONSABLE_VEILLE',
      )
      ||
      roles.includes(
        'OPERATEUR_VEILLE',
      )
    );
  });


const hasInternalWatchAccess =
  computed(
    () =>
      [
        'ADMIN',
        'RESPONSABLE_VEILLE',
        'REFERENT_LABORATOIRE',
        'OPERATEUR_VEILLE',
      ].some(
        (role) =>
          (
            auth.user?.roles
            ??
            []
          ).includes(
            role,
          ),
      ),
  );


const visibleStatusOptions =
  computed(
    () =>
      hasInternalWatchAccess.value
        ? statusOptions
        : optionsFr([
          'PUBLIE',
        ]),
  );


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
    null,
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


function prioritySeverity(
  value:
    string
    |
    null,
) {
  switch (
  value
  ) {
    case 'CRITIQUE':
      return 'danger';

    case 'ELEVEE':
      return 'warn';

    case 'MOYENNE':
      return 'info';

    case 'FAIBLE':
      return 'success';

    default:
      return 'secondary';
  }
}


function errorMessage(
  cause:
    unknown,

  fallback:
    string,
) {
  if (
    typeof cause ===
    'object'
    &&
    cause !==
    null
    &&
    'response' in
    cause
  ) {
    const response =
      (
        cause as {
          response?: {
            data?: {
              message?:
              string
              |
              string[];
            };
          };
        }
      ).response;

    const message =
      response
        ?.data
        ?.message;

    if (
      Array.isArray(
        message,
      )
    ) {
      return message
        .map(
          errorFr,
        )
        .join(
          ' ',
        );
    }

    if (
      typeof message ===
      'string'
    ) {
      return errorFr(
        message,
      );
    }
  }

  return fallback;
}


async function load() {
  const requestId =
    ++latestRequest;

  searchController
    ?.abort();

  searchController =
    new AbortController();

  loading.value =
    true;

  error.value =
    '';

  try {
    const response =
      await searchWatchItems(
        {
          q: filters.value.q,
          status: filters.value.status,
          criticality: filters.value.criticality,
          watchType: filters.value.watchType,
          sourceType: filters.value.sourceType,
          page: filters.value.page,
          limit: filters.value.limit,
          sortBy: filters.value.sortBy,
          sortOrder: filters.value.sortOrder,
          favoritesOnly: filters.value.favoritesOnly,
        },
        searchController.signal,
      );

    if (
      requestId !==
      latestRequest
    ) {
      return;
    }

    const result =
      response.data as
      WatchItemSearchResponse;

    items.value =
      result.items;

    total.value =
      result.total;
  } catch (
  cause
  ) {
    if (
      requestId !==
      latestRequest
    ) {
      return;
    }

    if (
      (
        cause as {
          code?:
          string;
        }
      )?.code ===
      'ERR_CANCELED'
    ) {
      return;
    }

    error.value =
      errorMessage(
        cause,
        'Impossible de charger les éléments de veille.',
      );
  } finally {
    if (
      requestId ===
      latestRequest
    ) {
      loading.value =
        false;
    }
  }
}


function scheduleSearch() {
  filters.value.page =
    1;

  if (
    searchTimer
  ) {
    clearTimeout(
      searchTimer,
    );
  }

  searchTimer =
    setTimeout(
      () => {
        void load();
      },
      350,
    );
}


async function loadExtras() {
  extrasLoading.value =
    true;

  try {
    const [
      favoritesResponse,
      viewsResponse,
    ] =
      await Promise.all([
        getFavorites(),
        getSavedViews(),
      ]);

    favorites.value =
      favoritesResponse.data
        .map(
          (
            favorite: {
              watchItem?: {
                id?:
                number;
              };
            },
          ) =>
            favorite
              .watchItem
              ?.id,
        )
        .filter(
          (
            id:
              number
              |
              undefined,
          ):
            id is number =>
            typeof id ===
            'number',
        );

    window.dispatchEvent(
      new CustomEvent(
        'favorites-changed',
        {
          detail:
            favorites.value.length,
        },
      ),
    );

    savedViews.value =
      viewsResponse.data;
  } catch (
  cause
  ) {
    error.value =
      errorMessage(
        cause,
        'Impossible de charger les favoris et les vues enregistrées.',
      );
  } finally {
    extrasLoading.value =
      false;
  }
}


async function toggleFavorite(
  id:
    number,
) {
  if (
    favoriteBusy.value.includes(
      id,
    )
  ) {
    return;
  }

  favoriteBusy.value = [
    ...favoriteBusy.value,
    id,
  ];

  const wasFavorite =
    favorites.value.includes(
      id,
    );

  try {
    if (
      wasFavorite
    ) {
      await removeFavorite(
        id,
      );
    } else {
      await addFavorite(
        id,
      );
    }

    await loadExtras();

    if (
      filters.value.favoritesOnly
      &&
      wasFavorite
    ) {
      await load();
    }

    toast.add({
      severity:
        'success',

      summary:
        wasFavorite
          ? 'Favori retiré'
          : 'Favori ajouté',

      detail:
        wasFavorite
          ? 'La veille a été retirée de vos favoris.'
          : 'La veille a été ajoutée à vos favoris.',

      life:
        3000,
    });
  } catch (
  cause
  ) {
    toast.add({
      severity:
        'error',

      summary:
        'Modification impossible',

      detail:
        errorMessage(
          cause,
          'Impossible de modifier ce favori.',
        ),

      life:
        4000,
    });
  } finally {
    favoriteBusy.value =
      favoriteBusy.value.filter(
        (itemId) =>
          itemId !==
          id,
      );
  }
}


async function saveView() {
  const name =
    viewName.value.trim();

  if (
    !name
  ) {
    return;
  }

  try {
    await createSavedView({
      name,

      filters: {
        ...filters.value,
      },
    });

    saveDialog.value =
      false;

    viewName.value =
      '';

    await loadExtras();

    toast.add({
      severity:
        'success',

      summary:
        'Vue enregistrée',

      detail:
        `La vue « ${name} » est disponible.`,

      life:
        3000,
    });
  } catch (
  cause
  ) {
    toast.add({
      severity:
        'error',

      summary:
        'Enregistrement impossible',

      detail:
        errorMessage(
          cause,
          'Impossible d’enregistrer cette vue.',
        ),

      life:
        4000,
    });
  }
}


function applyView(
  view:
    SavedView,
) {
  filters.value = {
    ...filters.value,

    ...view.filters,

    page:
      1,

    favoritesOnly:
      favoritesMode.value
        ? true
        : Boolean(
          view.filters
            .favoritesOnly,
        ),
  };
  filters.value.sortBy = querySortBy(filters.value.sortBy);
  filters.value.sortOrder = querySortOrder(filters.value.sortOrder);
  filters.value.addedOrder = filters.value.sortBy === 'collectedAt'
    ? filters.value.sortOrder
    : querySortOrder(filters.value.addedOrder);
}


async function removeSavedView() {
  if (
    !viewToDelete.value
    ||
    deletingView.value
  ) {
    return;
  }

  const selectedView =
    viewToDelete.value;

  deletingView.value =
    true;

  try {
    await deleteSavedView(
      selectedView.id,
    );

    await loadExtras();

    viewToDelete.value =
      null;

    toast.add({
      severity:
        'success',

      summary:
        'Vue supprimée',

      detail:
        `La vue « ${selectedView.name} » a été supprimée.`,

      life:
        3500,
    });
  } catch (
  cause
  ) {
    toast.add({
      severity:
        'error',

      summary:
        'Suppression impossible',

      detail:
        errorMessage(
          cause,
          'Impossible de supprimer cette vue enregistrée.',
        ),

      life:
        4500,
    });
  } finally {
    deletingView.value =
      false;
  }
}


function search() {
  filters.value.page =
    1;

  if (
    searchTimer
  ) {
    clearTimeout(
      searchTimer,
    );
  }

  void load();
}


function resetFilters() {
  filters.value = {
    q:
      '',

    status:
      '',

    criticality:
      '',

    watchType:
      '',

    sourceType:
      '',

    addedOrder:
      'DESC',

    page:
      1,

    limit:
      20,

    sortBy:
      'collectedAt',

    sortOrder:
      'DESC',

    favoritesOnly:
      favoritesMode.value,
  };
  filters.value.sortOrder = filters.value.addedOrder;
}


function changeAddedOrder(order: 'ASC' | 'DESC') {
  filters.value.addedOrder = order;
  filters.value.sortBy = 'collectedAt';
  filters.value.sortOrder = order;
  filters.value.page = 1;
}


function changePage(
  event: {
    page:
    number;

    rows:
    number;
  },
) {
  filters.value.page =
    event.page + 1;

  filters.value.limit =
    event.rows;

  void load();
}


function changeSort(
  event: {
    sortField?:
    string
    |
    (
      (
        item:
          WatchItem,
      ) => string
    );

    sortOrder?:
    1
    |
    0
    |
    -1
    |
    null;
  },
) {
  if (
    typeof event.sortField !==
    'string'
    ||
    !event.sortOrder
  ) {
    return;
  }

  filters.value.sortBy =
    event.sortField;

  filters.value.sortOrder =
    event.sortOrder ===
      1
      ? 'ASC'
      : 'DESC';

  filters.value.page =
    1;
}


onMounted(
  async () => {
    await Promise.allSettled([
      load(),
      loadExtras(),
    ]);
  },
);


watch(
  () => [
    filters.value.q,
    filters.value.status,
    filters.value.criticality,
    filters.value.watchType,
    filters.value.sourceType,
    filters.value.addedOrder,
    filters.value.sortBy,
    filters.value.sortOrder,
    filters.value.favoritesOnly,
  ],
  scheduleSearch,
);


watch(
  () =>
    route.query.favorites,

  (value) => {
    filters.value.favoritesOnly =
      value ===
      '1';

    filters.value.page =
      1;
  },
);


onBeforeUnmount(() => {
  if (
    searchTimer
  ) {
    clearTimeout(
      searchTimer,
    );
  }

  searchController
    ?.abort();
});
</script>


<template>
  <AppLayout>

    <div class="watch-page">

      <PageHeader :title="pageTitle
        " :subtitle="pageSubtitle
          " eyebrow="Veille" icon="pi pi-book">
        <template #actions>

          <Button v-if="
            canCreateSource
          " label="Ajouter une source" @click="
            sourceDialogVisible =
            true
            ">
            <template #icon>
              <PlusIcon size="0.9rem" />
            </template>
          </Button>

          <Button label="Enregistrer la vue" severity="secondary" @click="
            saveDialog =
            true
            ">
            <template #icon>
              <BookmarkIcon size="0.9rem" />
            </template>
          </Button>

        </template>
      </PageHeader>


      <Message v-if="
        error
      " severity="error" closable @close="
        error = ''
        ">
        {{ error }}
      </Message>


      <SectionCard compact>
        <div class="filters-grid">

          <div class="search-field">
            <i class="pi pi-search" />

            <InputText v-model="filters.q
              " class="w-full" placeholder="Rechercher un flux, un titre ou un résumé..." @keyup.enter="
                search
              " />
          </div>


          <div class="select-host">
            <Select append-to="self" v-model="filters.status
              " :options="visibleStatusOptions
                " option-label="label" option-value="value" show-clear placeholder="Statut" class="w-full" />
          </div>


          <div class="select-host">
            <Select append-to="self" v-model="filters.criticality
              " :options="criticalityOptions
                " option-label="label" option-value="value" show-clear placeholder="Importance" class="w-full" />
          </div>


          <div class="select-host">
            <Select append-to="self" v-model="filters.watchType
              " :options="watchTypeOptions
                " option-label="label" option-value="value" show-clear placeholder="Type de veille" class="w-full" />
          </div>


          <div class="select-host">
            <Select append-to="self" v-model="filters.sourceType
              " :options="sourceTypeOptions
                " option-label="label" option-value="value" show-clear placeholder="Type de source" class="w-full" />
          </div>


          <div class="select-host">
            <Select append-to="self" :model-value="filters.addedOrder" :options="addedOrderOptions"
              option-label="label" option-value="value" class="w-full"
              aria-label="Trier les éléments par date d’ajout"
              @update:model-value="changeAddedOrder" />
          </div>


          <Button label="Réinitialiser" icon="pi pi-filter-slash" severity="secondary" text @click="
            resetFilters
          " />

        </div>
      </SectionCard>


      <div v-if="
        savedViews.length
        ||
        extrasLoading
      " class="saved-views">

        <span class="saved-title">
          <BookmarkIcon size="0.8rem" />

          Vues enregistrées
        </span>


        <div v-for="
view in
  savedViews
          " :key="view.id
            " class="saved-chip">

          <button type="button" @click="
            applyView(
              view,
            )
            ">
            {{ view.name }}
          </button>


          <button type="button" aria-label="Supprimer" @click="
            viewToDelete =
            view
            ">
            <TrashIcon size="0.7rem" />
          </button>

        </div>


        <AppSpinner v-if="
          extrasLoading
        " size="small" label="Chargement…" />

      </div>


      <SectionCard :title="`${total} élément${total > 1 ? 's' : ''}`
        " subtitle="Informations collectées et disponibles dans la plateforme." icon="pi pi-list">

        <DataTable class="watch-table" table-style="width: 100%; table-layout: fixed" :value="items
          " :loading="loading
            " data-key="id" lazy paginator :first="(
              filters.page - 1
            )
              *
              filters.limit
              " :rows="filters.limit
                " :rows-per-page-options="[
                  10,
                  20,
                  50,
                ]
                  " :total-records="total
                  " :sort-field="filters.sortBy
                  " :sort-order="filters.sortOrder ===
                  'ASC'
                  ? 1
                  : -1
                  " @page="
                  changePage
                " @sort="
                changeSort
              ">

          <template #empty>
            Aucun élément ne correspond aux critères sélectionnés.
          </template>


          <Column header="Flux" sort-field="sourceName" sortable style="width: 13%">
            <template #body="{ data }">

              <div class="source-cell">
                <strong>
                  {{
                    data.source?.name
                    ??
                    'Non renseigné'
                  }}
                </strong>

                <span>
                  {{
                    labelFr(
                      data.watchType,
                    )
                  }}
                </span>
              </div>

            </template>
          </Column>


          <Column header="Type de source" sort-field="sourceType" sortable style="width: 10%">
            <template #body="{ data }">
              <SourceTypeBadge :type="data.source
                ?.sourceType
                " />
            </template>
          </Column>


          <Column field="title" header="Titre" sortable style="width: 20%">
            <template #body="{ data }">

              <button type="button" class="title-link" @click="openWatchItem(data.id)">
                {{ data.title }}
              </button>

            </template>
          </Column>


          <Column header="Publication" sort-field="publishedAt" sortable style="width: 11%">
            <template #body="{ data }">
              <span class="date-text">
                {{
                  formatDate(
                    data.publishedAt,
                  )
                }}
              </span>
            </template>
          </Column>


          <Column header="Résumé" style="width: 17%">
            <template #body="{ data }">
              <p class="watch-summary">
                {{
                  data.summary
                  ||
                  'Aucun résumé disponible.'
                }}
              </p>
            </template>
          </Column>


          <Column header="Importance" sort-field="relevance" sortable style="width: 10%">
            <template #body="{ data }">

              <Tag :value="data.criticality
                ? labelFr(
                  data.criticality,
                )
                : 'Non qualifiée'
                " :severity="prioritySeverity(
                  data.criticality,
                )
                  " />

            </template>
          </Column>


          <Column header="Statut" sort-field="status" sortable style="width: 9%">
            <template #body="{ data }">
              <StatusBadge :status="data.status
                " />
            </template>
          </Column>


          <Column header="Actions" style="width: 10%">
            <template #body="{ data }">

              <div class="table-actions">

                <Button severity="secondary" rounded size="small" aria-label="Voir la veille" title="Voir la veille"
                  @click="openWatchItem(data.id)">
                  <template #icon>
                    <ArrowRightIcon size="0.8rem" />
                  </template>
                </Button>


                <Button v-if="
                  canQualify
                  &&
                  [
                    'NOUVEAU',
                    'A_QUALIFIER',
                  ].includes(
                    data.status,
                  )
                " severity="secondary" rounded size="small" aria-label="Qualifier" title="Qualifier"
                @click="openWatchItem(data.id, true)">
                  <template #icon>
                    <CheckCircleIcon size="0.8rem" />
                  </template>
                </Button>


                <Button severity="secondary" rounded size="small" :aria-label="favorites.includes(
                  data.id,
                )
                  ? 'Retirer des favoris'
                  : 'Ajouter aux favoris'
                  " :title="favorites.includes(
                    data.id,
                  )
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                    " :loading="favoriteBusy.includes(
                      data.id,
                    )
                      " @click="
                        toggleFavorite(
                          data.id,
                        )
                        ">
                  <template #icon>

                    <StarFillIcon v-if="
                      favorites.includes(
                        data.id,
                      )
                    " size="0.8rem" />

                    <StarIcon v-else size="0.8rem" />

                  </template>
                </Button>


                <Button v-if="
                  safeExternalUrl(data.url)
                " as="a" :href="safeExternalUrl(data.url)
                  " target="_blank" rel="noopener noreferrer" severity="secondary" rounded size="small"
                  aria-label="Ouvrir la source" title="Ouvrir la source">
                  <template #icon>
                    <ExternalLinkIcon size="0.8rem" />
                  </template>
                </Button>

              </div>

            </template>
          </Column>

        </DataTable>

      </SectionCard>


      <Dialog v-model:visible="saveDialog
        " modal header="Enregistrer la vue" class="w-full max-w-md">
        <form class="space-y-4" @submit.prevent="
          saveView
        ">

          <div>
            <label for="saved-view-name" class="required-label mb-2 block">
              Nom de la vue
            </label>

            <InputText id="saved-view-name" v-model="viewName
              " class="w-full" placeholder="Exemple : Veilles critiques" maxlength="150" autofocus />
          </div>


          <div class="dialog-actions">

            <Button type="button" label="Annuler" severity="secondary" @click="
              saveDialog =
              false
              " />

            <Button type="submit" label="Enregistrer" :disabled="!viewName.trim()
              " />

          </div>

        </form>
      </Dialog>


      <Dialog :visible="Boolean(
        viewToDelete,
      )
        " modal header="Supprimer la vue" class="w-full max-w-md" :closable="!deletingView
          " :close-on-escape="!deletingView
            " @update:visible="
              (
                visible,
              ) => {
                if (
                  !visible
                  &&
                  !deletingView
                ) {
                  viewToDelete =
                    null;
                }
              }
            ">

        <p>
          Êtes-vous sûr de vouloir supprimer
          <strong>
            « {{ viewToDelete?.name }} »
          </strong>
          ?
        </p>

        <div class="dialog-actions">

          <Button label="Annuler" severity="secondary" :disabled="deletingView
            " @click="
              viewToDelete =
              null
              " />

          <Button label="Supprimer" severity="danger" :loading="deletingView
            " @click="
              removeSavedView
            " />

        </div>

      </Dialog>


      <Dialog v-model:visible="sourceDialogVisible
        " modal header="Nouvelle source" class="watch-source-dialog w-full max-w-2xl">

        <form id="watch-source-form" class="space-y-4" @submit.prevent="
          submitSource
        ">

          <Message v-if="
            sourceError
          " severity="error">
            {{ sourceError }}
          </Message>


          <div class="grid gap-4 md:grid-cols-2">

            <div>
              <label class="required-label mb-2 block">
                Nom
              </label>

              <InputText v-model="sourceForm.name
                " class="w-full" required />
            </div>


            <div>
              <label class="mb-2 block">
                Organisme
              </label>

              <InputText v-model="sourceForm.organization
                " class="w-full" />
            </div>


            <div>
              <label class="mb-2 block">
                Pays
              </label>

              <InputText v-model="sourceForm.country
                " class="w-full" />
            </div>


            <div>
              <label class="required-label mb-2 block">
                Catégorie
              </label>

              <div class="select-host">
                <Select append-to="self" v-model="sourceForm.category
                  " :options="optionsFr(
                    sourceCategoryOptions,
                  )
                    " option-label="label" option-value="value" class="w-full" required />
              </div>
            </div>


            <div>
              <label class="required-label mb-2 block">
                Type
              </label>

              <div class="select-host">
                <Select append-to="self" v-model="sourceForm.sourceType
                  " :options="optionsFr(
                    sourceCreationTypeOptions,
                  )
                    " option-label="label" option-value="value" class="w-full" required />
              </div>
            </div>


            <div v-if="
              sourceForm.sourceType !==
              'IMPORT_MANUEL'
            ">
              <label class="mb-2 block">
                Fréquence
              </label>

              <InputText v-model="sourceForm.frequency
                " class="w-full" placeholder="Ex. : 30m, 6h ou 1j" />
              <p class="helper-text">m : minutes · h : heures · j : jours</p>
            </div>

          </div>


          <div v-if="
            sourceForm.sourceType !==
            'IMPORT_MANUEL'
          ">
            <label class="required-label mb-2 block">
              Adresse de la source
            </label>

            <InputText v-model="sourceForm.baseUrl
              " class="w-full" placeholder="https://..." required />
            <p v-if="sourceForm.sourceType === 'API'" class="helper-text">
              Crossref est proposé ; vous pouvez saisir une autre URL API renvoyant une liste JSON d’articles.
            </p>
            <p v-else class="helper-text">
              Utilisez l’adresse exacte du flux. Son contenu XML, JSON ou CSV est détecté automatiquement.
            </p>
          </div>


          <div v-if="
            sourceForm.sourceType !==
            'IMPORT_MANUEL'
          ">
            <label class="mb-2 block">
              Sujet à surveiller
            </label>

            <InputText v-model="targetQuery" class="w-full"
              placeholder="Ex. : environnement, ISO 17025, laboratoire, microbiologie" />

            <p class="helper-text">
              Séparez les sujets par des virgules.
            </p>
          </div>


          <Message v-if="sourceForm.sourceType === 'IMPORT_MANUEL'" severity="info" :closable="false">
            Après la création, utilisez le bouton Importer de la source pour charger un fichier CSV ou XLSX. Aucune
            collecte
            automatique ne sera lancée.
          </Message>

        </form>

        <template #footer>
          <div class="source-dialog-footer">
            <label v-if="auth.isAdmin && sourceForm.sourceType !== 'IMPORT_MANUEL'" class="source-connector-choice">
              <Checkbox v-model="createWithConnector" binary />
              <span>Créer aussi le connecteur de collecte</span>
            </label>
            <div class="dialog-actions">
              <Button type="button" label="Annuler" severity="secondary" @click="sourceDialogVisible = false" />
              <Button type="submit" form="watch-source-form" label="Créer la source" :loading="sourceSubmitting" />
            </div>
          </div>
        </template>

      </Dialog>

    </div>

  </AppLayout>
</template>


<style scoped>
:global(.watch-source-dialog) {
  max-height: calc(100dvh - 2rem);
}

:global(.watch-source-dialog .p-dialog-content),
:global(.watch-source-dialog .p-dialog-content:has(.p-select-overlay)) {
  min-height: 0;
  overflow-y: auto !important;
}

:global(.watch-source-dialog .p-dialog-footer) {
  flex: none;
  border-top: 1px solid var(--app-border);
  background: var(--app-surface);
}

.source-dialog-footer {
  display: grid;
  width: 100%;
  gap: .7rem;
}

.source-connector-choice {
  display: flex;
  align-items: center;
  gap: .55rem;
  color: var(--app-text-secondary);
  font-size: .75rem;
  cursor: pointer;
}

.watch-page {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.filters-grid {
  display: grid;

  grid-template-columns:
    minmax(16rem, 2fr) repeat(4, minmax(10.5rem, 1fr));

  gap:
    0.65rem;

  align-items:
    center;
}

.search-field {
  position:
    relative;

  display:
    flex;

  align-items:
    center;
}

.search-field i {
  position:
    absolute;

  left:
    0.8rem;

  z-index:
    2;

  color:
    var(--app-text-muted);

  font-size:
    0.72rem;
}

.search-field :deep(input) {
  padding-left:
    2.2rem;
}

.saved-views {
  display:
    flex;

  flex-wrap:
    wrap;

  align-items:
    center;

  gap:
    0.5rem;

  padding:
    0.65rem 0.8rem;

  border:
    1px solid var(--app-border);

  border-radius:
    0.8rem;

  background:
    var(--app-surface);
}

.saved-title {
  display:
    inline-flex;

  align-items:
    center;

  gap:
    0.35rem;

  margin-right:
    0.25rem;

  color:
    var(--app-text-muted);

  font-size:
    0.7rem;

  font-weight:
    700;
}

.saved-chip {
  display:
    flex;

  overflow:
    hidden;

  border-radius:
    0.65rem;

  background:
    var(--app-surface-2);
}

.saved-chip button {
  border:
    0;

  background:
    transparent;

  color:
    var(--app-text-secondary);

  padding:
    0.45rem 0.65rem;

  font-size:
    0.7rem;

  cursor:
    pointer;
}

.saved-chip button:hover {
  color:
    var(--app-primary);
}

.source-cell {
  display:
    grid;

  gap:
    0.12rem;
}

.source-cell strong {
  color:
    var(--app-text);

  font-size:
    0.75rem;
}

.source-cell span,
.date-text,
.helper-text {
  color:
    var(--app-text-muted);

  font-size:
    0.68rem;
}

.title-link {
  border:
    0;

  background:
    transparent;

  color:
    var(--app-text);

  font-size:
    0.76rem;

  font-weight:
    650;

  line-height:
    1.4;

  text-align:
    left;

  cursor:
    pointer;
}

.title-link:hover {
  color:
    var(--app-primary);
}

.watch-summary {
  display:
    -webkit-box;

  overflow:
    hidden;

  margin:
    0;

  color:
    var(--app-text-muted);

  font-size:
    0.72rem;

  line-height:
    1.45;

  -webkit-box-orient:
    vertical;

  -webkit-line-clamp:
    2;
}

.table-actions {
  display:
    flex;

  flex-wrap:
    wrap;

  gap:
    0.35rem;
}

.dialog-actions {
  display:
    flex;

  justify-content:
    flex-end;

  gap:
    0.65rem;

  margin-top:
    1rem;
}

.watch-table :deep(th),
.watch-table :deep(td) {
  overflow-wrap: anywhere;
}

.watch-table :deep(.p-datatable-column-header-content) {
  flex-wrap: wrap;
}

.watch-table :deep(.source-badge),
.watch-table :deep(.status-badge),
.watch-table :deep(.p-tag) {
  max-width: 100%;
  white-space: normal;
}

@media (max-width: 1500px) {
  .filters-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .filters-grid {
    grid-template-columns:
      1fr;
  }
}
</style>
