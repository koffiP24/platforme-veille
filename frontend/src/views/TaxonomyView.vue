<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  isAxiosError,
} from 'axios';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

import {
  useToast,
} from 'primevue/usetoast';

import PencilIcon from '@primeicons/vue/pencil';
import PlusIcon from '@primeicons/vue/plus';
import TrashIcon from '@primeicons/vue/trash';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';

import {
  createDomain,
  createKeyword,
  createLaboratory,
  createTopic,
  deleteDomain,
  deleteKeyword,
  deleteLaboratory,
  deleteTopic,
  getDomains,
  getKeywords,
  getLaboratories,
  getTopics,
  updateDomain,
  updateKeyword,
  updateLaboratory,
  updateTopic,
  type Domain,
  type Keyword,
  type Laboratory,
  type Topic,
} from '../services/taxonomy.service';


type TaxonomyKind =
  'topics'
  |
  'domains'
  |
  'laboratories'
  |
  'keywords';


interface DeleteTarget {
  id:
  number;

  kind:
  TaxonomyKind;

  label:
  string;

  typeLabel:
  string;
}


const toast =
  useToast();
const route = useRoute();
const router = useRouter();
const taxonomyTabs: TaxonomyKind[] = ['topics', 'domains', 'laboratories', 'keywords'];
const initialTab = typeof route.query.tab === 'string' && taxonomyTabs.includes(route.query.tab as TaxonomyKind)
  ? route.query.tab as TaxonomyKind
  : 'topics';
const activeTaxonomyTab = ref<TaxonomyKind>(initialTab);

function changeTaxonomyTab(value: string | number | undefined) {
  if (typeof value !== 'string' || !taxonomyTabs.includes(value as TaxonomyKind)) return;
  activeTaxonomyTab.value = value as TaxonomyKind;
  void router.replace({ query: { ...route.query, tab: value } });
}


const topics =
  ref<Topic[]>([]);

const domains =
  ref<Domain[]>([]);

const laboratories =
  ref<Laboratory[]>([]);

const keywords =
  ref<Keyword[]>([]);

const taxonomySearch = ref<Record<TaxonomyKind, string>>({
  topics: '',
  domains: '',
  laboratories: '',
  keywords: '',
});

function matchesTaxonomySearch(value: string, query: string) {
  return !query.trim() || value.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
}

const filteredTopics = computed(() => topics.value.filter((item) => matchesTaxonomySearch(`${item.label} ${item.description ?? ''}`, taxonomySearch.value.topics)));
const filteredDomains = computed(() => domains.value.filter((item) => matchesTaxonomySearch(`${item.name} ${item.description ?? ''}`, taxonomySearch.value.domains)));
const filteredLaboratories = computed(() => laboratories.value.filter((item) => matchesTaxonomySearch(`${item.name} ${item.description ?? ''}`, taxonomySearch.value.laboratories)));
const filteredKeywords = computed(() => keywords.value.filter((item) => matchesTaxonomySearch(`${item.label} ${item.weight}`, taxonomySearch.value.keywords)));


const loading =
  ref(false);

const saving =
  ref(false);

const deleting =
  ref(false);

const error =
  ref('');


const topicDialog =
  ref(false);

const domainDialog =
  ref(false);

const laboratoryDialog =
  ref(false);

const keywordDialog =
  ref(false);

const deleteDialog =
  ref(false);


const editingTopicId =
  ref<number | null>(
    null,
  );

const editingDomainId =
  ref<number | null>(
    null,
  );

const editingLaboratoryId =
  ref<number | null>(
    null,
  );

const editingKeywordId =
  ref<number | null>(
    null,
  );


const deleteTarget =
  ref<DeleteTarget | null>(
    null,
  );


const topicForm =
  ref({
    label:
      '',

    description:
      '',

    parentId:
      null as number | null,
  });


const domainForm =
  ref({
    name:
      '',

    description:
      '',

    active:
      true,
  });


const laboratoryForm =
  ref({
    name:
      '',

    description:
      '',

    active:
      true,
  });


const keywordForm =
  ref({
    label:
      '',

    weight:
      1,

    active:
      true,
  });


const statusOptions = [
  {
    label:
      'Actif',

    value:
      true,
  },

  {
    label:
      'Inactif',

    value:
      false,
  },
];


function weightDescription(
  weight:
    number,
) {
  if (
    weight <= 3
  ) {
    return 'Importance faible';
  }

  if (
    weight <= 6
  ) {
    return 'Importance moyenne';
  }

  if (
    weight <= 9
  ) {
    return 'Importance élevée';
  }

  return 'Importance critique';
}


const keywordWeightOptions =
  Array.from(
    {
      length:
        10,
    },

    (
      _,
      index,
    ) => {
      const value =
        index + 1;

      return {
        value,

        label:
          `${value} — ${weightDescription(value)}`,

        description:
          weightDescription(
            value,
          ),
      };
    },
  );


const topicParentOptions =
  computed(
    () =>
      topics.value.filter(
        (
          topic,
        ) =>
          topic.id !==
          editingTopicId.value,
      ),
  );


function apiError(
  cause:
    unknown,

  fallback:
    string,
) {
  const message =
    isAxiosError(
      cause,
    )
      ? cause.response
        ?.data
        ?.message
      : undefined;

  if (
    Array.isArray(
      message,
    )
  ) {
    return message.join(
      ' ',
    );
  }

  return typeof message ===
    'string'
    ? message
    : fallback;
}


function showSuccess(
  summary:
    string,

  detail:
    string,
) {
  toast.add({
    severity:
      'success',

    summary,

    detail,

    life:
      4500,
  });
}


function showFailure(
  cause:
    unknown,

  fallback:
    string,
) {
  const detail =
    apiError(
      cause,
      fallback,
    );

  error.value =
    detail;

  toast.add({
    severity:
      'error',

    summary:
      'Opération impossible',

    detail,

    life:
      6000,
  });
}


async function loadAll() {
  loading.value =
    true;

  error.value =
    '';

  try {
    const [
      topicsResponse,
      domainsResponse,
      laboratoriesResponse,
      keywordsResponse,
    ] =
      await Promise.all([
        getTopics(),
        getDomains(),
        getLaboratories(),
        getKeywords(),
      ]);

    topics.value =
      topicsResponse.data;

    domains.value =
      domainsResponse.data;

    laboratories.value =
      laboratoriesResponse.data;

    keywords.value =
      keywordsResponse.data;

  } catch (
  cause
  ) {
    error.value =
      apiError(
        cause,
        'Impossible de charger la taxonomie.',
      );

  } finally {
    loading.value =
      false;
  }
}


function openNewTopic() {
  editingTopicId.value =
    null;

  topicForm.value = {
    label:
      '',

    description:
      '',

    parentId:
      null,
  };

  topicDialog.value =
    true;
}


function editTopic(
  topic:
    Topic,
) {
  editingTopicId.value =
    topic.id;

  topicForm.value = {
    label:
      topic.label,

    description:
      topic.description
      ??
      '',

    parentId:
      topic.parent?.id
      ??
      null,
  };

  topicDialog.value =
    true;
}


function openNewDomain() {
  editingDomainId.value =
    null;

  domainForm.value = {
    name:
      '',

    description:
      '',

    active:
      true,
  };

  domainDialog.value =
    true;
}


function editDomain(
  domain:
    Domain,
) {
  editingDomainId.value =
    domain.id;

  domainForm.value = {
    name:
      domain.name,

    description:
      domain.description
      ??
      '',

    active:
      domain.active,
  };

  domainDialog.value =
    true;
}


function openNewLaboratory() {
  editingLaboratoryId.value =
    null;

  laboratoryForm.value = {
    name:
      '',

    description:
      '',

    active:
      true,
  };

  laboratoryDialog.value =
    true;
}


function editLaboratory(
  laboratory:
    Laboratory,
) {
  editingLaboratoryId.value =
    laboratory.id;

  laboratoryForm.value = {
    name:
      laboratory.name,

    description:
      laboratory.description
      ??
      '',

    active:
      laboratory.active,
  };

  laboratoryDialog.value =
    true;
}


function openNewKeyword() {
  editingKeywordId.value =
    null;

  keywordForm.value = {
    label:
      '',

    weight:
      1,

    active:
      true,
  };

  keywordDialog.value =
    true;
}


function editKeyword(
  keyword:
    Keyword,
) {
  editingKeywordId.value =
    keyword.id;

  keywordForm.value = {
    label:
      keyword.label,

    weight:
      Number(
        keyword.weight,
      ),

    active:
      keyword.active,
  };

  keywordDialog.value =
    true;
}


async function submitTopic() {
  if (
    saving.value
  ) {
    return;
  }

  saving.value =
    true;

  error.value =
    '';

  const id =
    editingTopicId.value;

  try {
    const payload = {
      label:
        topicForm.value.label,

      description:
        topicForm.value.description
        ||
        (
          id
            ? null
            : undefined
        ),

      parentId:
        topicForm.value.parentId,
    };


    if (
      id
    ) {
      await updateTopic(
        id,
        payload,
      );
    } else {
      await createTopic(
        payload,
      );
    }


    topicDialog.value =
      false;


    showSuccess(
      id
        ? 'Thème modifié'
        : 'Thème créé',

      'Les informations du thème ont été enregistrées.',
    );


    await loadAll();

  } catch (
  cause
  ) {
    showFailure(
      cause,

      id
        ? 'Modification du thème impossible.'
        : 'Création du thème impossible.',
    );

  } finally {
    saving.value =
      false;
  }
}


async function submitDomain() {
  if (
    saving.value
  ) {
    return;
  }

  saving.value =
    true;

  error.value =
    '';

  const id =
    editingDomainId.value;

  try {
    if (
      id
    ) {
      await updateDomain(
        id,
        domainForm.value,
      );
    } else {
      await createDomain(
        domainForm.value,
      );
    }

    domainDialog.value =
      false;


    showSuccess(
      id
        ? 'Domaine modifié'
        : 'Domaine créé',

      'Les informations du domaine ont été enregistrées.',
    );


    await loadAll();

  } catch (
  cause
  ) {
    showFailure(
      cause,

      id
        ? 'Modification du domaine impossible.'
        : 'Création du domaine impossible.',
    );

  } finally {
    saving.value =
      false;
  }
}


async function submitLaboratory() {
  if (
    saving.value
  ) {
    return;
  }

  saving.value =
    true;

  error.value =
    '';

  const id =
    editingLaboratoryId.value;

  try {
    if (
      id
    ) {
      await updateLaboratory(
        id,
        laboratoryForm.value,
      );
    } else {
      await createLaboratory(
        laboratoryForm.value,
      );
    }

    laboratoryDialog.value =
      false;


    showSuccess(
      id
        ? 'Laboratoire modifié'
        : 'Laboratoire créé',

      'Les informations ont été enregistrées.',
    );


    await loadAll();

  } catch (
  cause
  ) {
    showFailure(
      cause,

      id
        ? 'Modification du laboratoire impossible.'
        : 'Création du laboratoire impossible.',
    );

  } finally {
    saving.value =
      false;
  }
}


async function submitKeyword() {
  if (
    saving.value
  ) {
    return;
  }

  saving.value =
    true;

  error.value =
    '';

  const id =
    editingKeywordId.value;

  try {
    if (
      id
    ) {
      await updateKeyword(
        id,
        keywordForm.value,
      );
    } else {
      await createKeyword(
        keywordForm.value,
      );
    }

    keywordDialog.value =
      false;


    showSuccess(
      id
        ? 'Mot-clé modifié'
        : 'Mot-clé créé',

      'Les informations du mot-clé ont été enregistrées.',
    );


    await loadAll();

  } catch (
  cause
  ) {
    showFailure(
      cause,

      id
        ? 'Modification du mot-clé impossible.'
        : 'Création du mot-clé impossible.',
    );

  } finally {
    saving.value =
      false;
  }
}


function askDelete(
  target:
    DeleteTarget,
) {
  deleteTarget.value =
    target;

  deleteDialog.value =
    true;
}


async function confirmDelete() {
  const target =
    deleteTarget.value;

  if (
    !target
    ||
    deleting.value
  ) {
    return;
  }

  deleting.value =
    true;

  error.value =
    '';

  try {
    const actions:
      Record<
        TaxonomyKind,
        (
          id:
            number,
        ) =>
          Promise<unknown>
      > = {
      topics:
        deleteTopic,

      domains:
        deleteDomain,

      laboratories:
        deleteLaboratory,

      keywords:
        deleteKeyword,
    };


    await actions[
      target.kind
    ](
      target.id,
    );


    deleteDialog.value =
      false;

    deleteTarget.value =
      null;


    showSuccess(
      'Suppression réussie',
      `Le ${target.typeLabel} a été supprimé.`,
    );


    await loadAll();

  } catch (
  cause
  ) {
    showFailure(
      cause,
      `Impossible de supprimer le ${target.typeLabel}.`,
    );

  } finally {
    deleting.value =
      false;
  }
}


onMounted(
  loadAll,
);
</script>


<template>
  <AppLayout>

    <div class="taxonomy-page">

      <PageHeader title="Taxonomie"
        subtitle="Gestion des thèmes, domaines, laboratoires et mots-clés utilisés pour qualifier la veille."
        eyebrow="Administration" icon="pi pi-sitemap" />


      <Message v-if="
        error
      " severity="error" closable @close="
        error = ''
        ">
        {{ error }}
      </Message>


      <SectionCard>

        <Tabs v-model:value="activeTaxonomyTab" class="taxonomy-tabs" @update:value="changeTaxonomyTab">

          <TabList>
            <Tab value="topics">
              Thèmes
            </Tab>

            <Tab value="domains">
              Domaines
            </Tab>

            <Tab value="laboratories">
              Laboratoires
            </Tab>

            <Tab value="keywords">
              Mots-clés
            </Tab>
          </TabList>


          <TabPanels>

            <!-- THÈMES -->

            <TabPanel value="topics">

              <div class="panel-content">

                <div class="panel-header">

                  <div>
                    <h3>
                      Thèmes
                    </h3>

                    <p>
                      Organisation hiérarchique des sujets de veille.
                    </p>
                  </div>

                  <Button label="Ajouter un thème" @click="
                    openNewTopic
                  ">
                    <template #icon>
                      <PlusIcon size="0.9rem" />
                    </template>
                  </Button>

                </div>


                  <InputText v-model="taxonomySearch.topics" placeholder="Rechercher un thème..." class="taxonomy-search" />

                  <DataTable :value="filteredTopics
                  " :loading="loading
                    " paginator :rows="10
                      ">

                  <template #empty>
                    Aucun thème enregistré.
                  </template>


                  <Column field="label" header="Libellé" sortable />


                  <Column field="description" header="Description">
                    <template #body="{ data }">
                      <span class="secondary-text">
                        {{
                          data.description
                          ||
                          'Aucune description'
                        }}
                      </span>
                    </template>
                  </Column>


                  <Column header="Parent">
                    <template #body="{ data }">
                      {{
                        data.parent?.label
                        ??
                        '—'
                      }}
                    </template>
                  </Column>


                  <Column header="Actions" style="width: 7rem">
                    <template #body="{ data }">

                      <div class="row-actions">

                        <Button severity="secondary" rounded size="small" title="Modifier le thème"
                          aria-label="Modifier le thème" @click="
                            editTopic(
                              data,
                            )
                            ">
                          <template #icon>
                            <PencilIcon size="0.85rem" />
                          </template>
                        </Button>


                        <Button severity="danger" text rounded size="small" title="Supprimer le thème"
                          aria-label="Supprimer le thème" @click="
                            askDelete({
                              id:
                                data.id,

                              kind:
                                'topics',

                              label:
                                data.label,

                              typeLabel:
                                'thème',
                            })
                            ">
                          <template #icon>
                            <TrashIcon size="0.85rem" />
                          </template>
                        </Button>

                      </div>

                    </template>
                  </Column>

                </DataTable>

              </div>

            </TabPanel>


            <!-- DOMAINES -->

            <TabPanel value="domains">

              <div class="panel-content">

                <div class="panel-header">

                  <div>
                    <h3>
                      Domaines
                    </h3>

                    <p>
                      Domaines métiers utilisés pour classifier les veilles.
                    </p>
                  </div>

                  <Button label="Ajouter un domaine" @click="
                    openNewDomain
                  ">
                    <template #icon>
                      <PlusIcon size="0.9rem" />
                    </template>
                  </Button>

                </div>


                <InputText v-model="taxonomySearch.domains" placeholder="Rechercher un domaine..." class="taxonomy-search" />

                <DataTable :value="filteredDomains
                  " :loading="loading
                    " paginator :rows="10
                      ">

                  <template #empty>
                    Aucun domaine enregistré.
                  </template>


                  <Column field="name" header="Nom" sortable />


                  <Column header="Description">
                    <template #body="{ data }">
                      <span class="secondary-text">
                        {{
                          data.description
                          ||
                          'Aucune description'
                        }}
                      </span>
                    </template>
                  </Column>


                  <Column header="Statut" style="width: 8rem">
                    <template #body="{ data }">
                      <Tag :value="data.active
                        ? 'Actif'
                        : 'Inactif'
                        " :severity="data.active
                          ? 'success'
                          : 'secondary'
                          " />
                    </template>
                  </Column>


                  <Column header="Actions" style="width: 7rem">
                    <template #body="{ data }">

                      <div class="row-actions">

                        <Button severity="secondary" rounded size="small" @click="
                          editDomain(
                            data,
                          )
                          ">
                          <template #icon>
                            <PencilIcon size="0.85rem" />
                          </template>
                        </Button>


                        <Button severity="danger" text rounded size="small" @click="
                          askDelete({
                            id:
                              data.id,

                            kind:
                              'domains',

                            label:
                              data.name,

                            typeLabel:
                              'domaine',
                          })
                          ">
                          <template #icon>
                            <TrashIcon size="0.85rem" />
                          </template>
                        </Button>

                      </div>

                    </template>
                  </Column>

                </DataTable>

              </div>

            </TabPanel>


            <!-- LABORATOIRES -->

            <TabPanel value="laboratories">

              <div class="panel-content">

                <div class="panel-header">

                  <div>
                    <h3>
                      Laboratoires
                    </h3>

                    <p>
                      Laboratoires concernés par les éléments de veille.
                    </p>
                  </div>

                  <Button label="Ajouter un laboratoire" @click="
                    openNewLaboratory
                  ">
                    <template #icon>
                      <PlusIcon size="0.9rem" />
                    </template>
                  </Button>

                </div>


                <InputText v-model="taxonomySearch.laboratories" placeholder="Rechercher un laboratoire..." class="taxonomy-search" />

                <DataTable :value="filteredLaboratories
                  " :loading="loading
                    " paginator :rows="10
                      ">

                  <template #empty>
                    Aucun laboratoire enregistré.
                  </template>


                  <Column field="name" header="Nom" sortable />


                  <Column header="Description">
                    <template #body="{ data }">
                      <span class="secondary-text">
                        {{
                          data.description
                          ||
                          'Aucune description'
                        }}
                      </span>
                    </template>
                  </Column>


                  <Column header="Statut" style="width: 8rem">
                    <template #body="{ data }">
                      <Tag :value="data.active
                        ? 'Actif'
                        : 'Inactif'
                        " :severity="data.active
                          ? 'success'
                          : 'secondary'
                          " />
                    </template>
                  </Column>


                  <Column header="Actions" style="width: 7rem">
                    <template #body="{ data }">

                      <div class="row-actions">

                        <Button severity="secondary" rounded size="small" @click="
                          editLaboratory(
                            data,
                          )
                          ">
                          <template #icon>
                            <PencilIcon size="0.85rem" />
                          </template>
                        </Button>


                        <Button severity="danger" text rounded size="small" @click="
                          askDelete({
                            id:
                              data.id,

                            kind:
                              'laboratories',

                            label:
                              data.name,

                            typeLabel:
                              'laboratoire',
                          })
                          ">
                          <template #icon>
                            <TrashIcon size="0.85rem" />
                          </template>
                        </Button>

                      </div>

                    </template>
                  </Column>

                </DataTable>

              </div>

            </TabPanel>


            <!-- MOTS-CLÉS -->

            <TabPanel value="keywords">

              <div class="panel-content">

                <div class="panel-header">

                  <div>
                    <h3>
                      Mots-clés
                    </h3>

                    <p>
                      Vocabulaire utilisé pour la qualification automatique et manuelle.
                    </p>
                  </div>

                  <Button label="Ajouter un mot-clé" @click="
                    openNewKeyword
                  ">
                    <template #icon>
                      <PlusIcon size="0.9rem" />
                    </template>
                  </Button>

                </div>


                <InputText v-model="taxonomySearch.keywords" placeholder="Rechercher un mot-clé..." class="taxonomy-search" />

                <DataTable :value="filteredKeywords
                  " :loading="loading
                    " paginator :rows="10
                      ">

                  <template #empty>
                    Aucun mot-clé enregistré.
                  </template>


                  <Column field="label" header="Mot-clé" sortable />


                  <Column field="weight" header="Poids" sortable>
                    <template #body="{ data }">

                      <div class="weight-cell">

                        <strong>
                          {{ data.weight }}
                        </strong>

                        <span>
                          {{
                            weightDescription(
                              Number(
                                data.weight,
                              ),
                            )
                          }}
                        </span>

                      </div>

                    </template>
                  </Column>


                  <Column header="Statut" style="width: 8rem">
                    <template #body="{ data }">
                      <Tag :value="data.active
                        ? 'Actif'
                        : 'Inactif'
                        " :severity="data.active
                          ? 'success'
                          : 'secondary'
                          " />
                    </template>
                  </Column>


                  <Column header="Actions" style="width: 7rem">
                    <template #body="{ data }">

                      <div class="row-actions">

                        <Button severity="secondary" rounded size="small" @click="
                          editKeyword(
                            data,
                          )
                          ">
                          <template #icon>
                            <PencilIcon size="0.85rem" />
                          </template>
                        </Button>


                        <Button severity="danger" text rounded size="small" @click="
                          askDelete({
                            id:
                              data.id,

                            kind:
                              'keywords',

                            label:
                              data.label,

                            typeLabel:
                              'mot-clé',
                          })
                          ">
                          <template #icon>
                            <TrashIcon size="0.85rem" />
                          </template>
                        </Button>

                      </div>

                    </template>
                  </Column>

                </DataTable>

              </div>

            </TabPanel>

          </TabPanels>

        </Tabs>

      </SectionCard>


      <!-- THÈME -->

      <Dialog v-model:visible="topicDialog
        " modal :header="editingTopicId
          ? 'Modifier le thème'
          : 'Nouveau thème'
          " class="w-full max-w-xl" :closable="!saving
            " :close-on-escape="!saving
              ">

        <form class="space-y-4" @submit.prevent="
          submitTopic
        ">

          <div>
            <label class="required-label mb-2 block">
              Libellé
            </label>

            <InputText v-model="topicForm.label
              " class="w-full" required />
          </div>


          <div>
            <label class="mb-2 block">
              Description
            </label>

            <Textarea v-model="topicForm.description
              " class="w-full" rows="4" />
          </div>


          <div class="select-host">

            <label class="mb-2 block">
              Thème parent
            </label>

            <Select append-to="self" v-model="topicForm.parentId
              " :options="topicParentOptions
                " option-label="label" option-value="id" show-clear placeholder="Aucun" class="w-full" />

          </div>


          <div class="dialog-actions">

            <Button type="button" label="Annuler" severity="secondary" :disabled="saving
              " @click="
                topicDialog =
                false
                " />

            <Button type="submit" :label="editingTopicId
              ? 'Enregistrer'
              : 'Créer'
              " :loading="saving
                " />

          </div>

        </form>

      </Dialog>


      <!-- DOMAINE -->

      <Dialog v-model:visible="domainDialog
        " modal :header="editingDomainId
          ? 'Modifier le domaine'
          : 'Nouveau domaine'
          " class="w-full max-w-xl" :closable="!saving
            ">

        <form class="space-y-4" @submit.prevent="
          submitDomain
        ">

          <div>
            <label class="required-label mb-2 block">
              Nom
            </label>

            <InputText v-model="domainForm.name
              " class="w-full" required />
          </div>


          <div>
            <label class="mb-2 block">
              Description
            </label>

            <Textarea v-model="domainForm.description
              " rows="4" class="w-full" />
          </div>


          <div class="select-host">

            <label class="mb-2 block">
              Statut
            </label>

            <Select append-to="self" v-model="domainForm.active
              " :options="statusOptions
                " option-label="label" option-value="value" class="w-full" />

          </div>


          <div class="dialog-actions">

            <Button type="button" label="Annuler" severity="secondary" @click="
              domainDialog =
              false
              " />

            <Button type="submit" :label="editingDomainId
              ? 'Enregistrer'
              : 'Créer'
              " :loading="saving
                " />

          </div>

        </form>

      </Dialog>


      <!-- LABORATOIRE -->

      <Dialog v-model:visible="laboratoryDialog
        " modal :header="editingLaboratoryId
          ? 'Modifier le laboratoire'
          : 'Nouveau laboratoire'
          " class="w-full max-w-xl" :closable="!saving
            ">

        <form class="space-y-4" @submit.prevent="
          submitLaboratory
        ">

          <div>
            <label class="required-label mb-2 block">
              Nom
            </label>

            <InputText v-model="laboratoryForm.name
              " class="w-full" required />
          </div>


          <div>
            <label class="mb-2 block">
              Description
            </label>

            <Textarea v-model="laboratoryForm.description
              " rows="4" class="w-full" />
          </div>


          <div class="select-host">

            <label class="mb-2 block">
              Statut
            </label>

            <Select append-to="self" v-model="laboratoryForm.active
              " :options="statusOptions
                " option-label="label" option-value="value" class="w-full" />

          </div>


          <div class="dialog-actions">

            <Button type="button" label="Annuler" severity="secondary" @click="
              laboratoryDialog =
              false
              " />

            <Button type="submit" :label="editingLaboratoryId
              ? 'Enregistrer'
              : 'Créer'
              " :loading="saving
                " />

          </div>

        </form>

      </Dialog>


      <!-- MOT-CLÉ -->

      <Dialog v-model:visible="keywordDialog
        " modal :header="editingKeywordId
          ? 'Modifier le mot-clé'
          : 'Nouveau mot-clé'
          " class="w-full max-w-xl" :closable="!saving
            ">

        <form class="space-y-4" @submit.prevent="
          submitKeyword
        ">

          <div>
            <label class="required-label mb-2 block">
              Libellé
            </label>

            <InputText v-model="keywordForm.label
              " class="w-full" required />
          </div>


          <div class="select-host">

            <label class="mb-2 block">
              Poids
            </label>

            <Select append-to="self" v-model="keywordForm.weight
              " :options="keywordWeightOptions
                " option-label="label" option-value="value" class="w-full" placeholder="Sélectionner un poids">
              <template #value="{ value, placeholder }">

                <div v-if="
                  value
                " class="weight-option">
                  <strong>
                    {{ value }}
                  </strong>

                  <span>
                    {{
                      weightDescription(
                        value,
                      )
                    }}
                  </span>
                </div>

                <span v-else class="p-placeholder">
                  {{ placeholder }}
                </span>

              </template>


              <template #option="{ option }">

                <div class="weight-option">

                  <strong>
                    {{ option.value }}
                  </strong>

                  <span>
                    {{ option.description }}
                  </span>

                </div>

              </template>
            </Select>

          </div>


          <div class="select-host">

            <label class="mb-2 block">
              Statut
            </label>

            <Select append-to="self" v-model="keywordForm.active
              " :options="statusOptions
                " option-label="label" option-value="value" class="w-full" />

          </div>


          <div class="dialog-actions">

            <Button type="button" label="Annuler" severity="secondary" @click="
              keywordDialog =
              false
              " />

            <Button type="submit" :label="editingKeywordId
              ? 'Enregistrer'
              : 'Créer'
              " :loading="saving
                " />

          </div>

        </form>

      </Dialog>


      <!-- SUPPRESSION -->

      <Dialog v-model:visible="deleteDialog
        " modal header="Confirmer la suppression" class="w-full max-w-md" :closable="!deleting
          ">

        <div class="space-y-5">

          <p v-if="
            deleteTarget
          ">
            Êtes-vous sûr de vouloir supprimer le
            {{ deleteTarget.typeLabel }}

            <strong>
              « {{ deleteTarget.label }} »
            </strong>
            ?
          </p>


          <Message severity="warn" :closable="false
            ">
            Cette suppression est définitive.
          </Message>


          <div class="dialog-actions">

            <Button label="Annuler" severity="secondary" :disabled="deleting
              " @click="
                deleteDialog =
                false
                " />

            <Button label="Supprimer" severity="danger" :loading="deleting
              " @click="
                confirmDelete
              ">
              <template #icon>
                <TrashIcon size="0.9rem" />
              </template>
            </Button>

          </div>

        </div>

      </Dialog>

    </div>

  </AppLayout>
</template>


<style scoped>
.taxonomy-page {
  display: grid;
  gap: 1rem;
}

:deep(.section-card) {
  overflow: visible;
}

.taxonomy-tabs {
  background: transparent;
}

:deep(.p-tablist) {
  border-bottom:
    1px solid var(--app-border);

  background:
    transparent;
}

:deep(.p-tab) {
  border: 0;

  background:
    transparent;

  color:
    var(--app-text-muted);

  font-size:
    0.75rem;
}

:deep(.p-tab-active) {
  color:
    var(--app-primary);
}

:deep(.p-tabpanels),
:deep(.p-tabpanel) {
  background:
    transparent;

  color:
    var(--app-text);
}

.panel-content {
  display: grid;
  gap: 1rem;

  padding-top:
    0.5rem;
}

.panel-header {
  display: flex;

  align-items: center;

  justify-content:
    space-between;

  gap:
    1rem;
}

.panel-header h3 {
  margin: 0;

  color:
    var(--app-text);

  font-size:
    0.9rem;
}

.panel-header p {
  margin:
    0.2rem 0 0;

  color:
    var(--app-text-muted);

  font-size:
    0.7rem;
}

.row-actions {
  display: flex;

  flex-wrap:
    nowrap;

  gap:
    0.35rem;
}

.secondary-text {
  color:
    var(--app-text-muted);

  font-size:
    0.72rem;
}

.weight-cell,
.weight-option {
  display: flex;

  align-items: center;

  gap:
    0.45rem;
}

.weight-cell strong,
.weight-option strong {
  color:
    var(--app-primary);
}

.weight-cell span,
.weight-option span {
  color:
    var(--app-text-muted);

  font-size:
    0.7rem;
}

.dialog-actions {
  display: flex;

  justify-content:
    flex-end;

  gap:
    0.65rem;
}


/* CORRECTION SELECT */

.select-host {
  position: relative;

  overflow: visible;

  isolation: isolate;

  z-index: 5;
}

.select-host :deep(.p-select) {
  position: relative;

  width: 100%;
}

.select-host :deep(.p-select-overlay) {
  position: absolute !important;

  left: 0 !important;

  right: auto !important;

  transform: none !important;

  width: 100% !important;

  min-width: 100% !important;

  max-width: 100% !important;

  z-index: 10000 !important;
}

:deep(.p-dialog-content) {
  overflow: visible !important;
}

@media (max-width: 640px) {
  .panel-header {
    align-items:
      stretch;

    flex-direction:
      column;
  }

  .panel-header :deep(.p-button) {
    width:
      100%;
  }
}
</style>
