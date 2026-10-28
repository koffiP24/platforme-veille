<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';

import {
  getAuditLogs,
} from '../services/audit.service';

import {
  getUsers,
} from '../services/users.service';

import {
  getWatchItems,
} from '../services/watch-items.service';


interface AuditLog {
  id:
  number;

  action:
  string;

  entity:
  string;

  entityId:
  number | null;

  entityDisplay?:
  string | null;

  reportScope?:
  string | null;

  beforeValue:
  unknown;

  afterValue:
  unknown;

  ipAddress:
  string | null;

  createdAt:
  string;

  user:
  {
    firstName:
    string;

    lastName:
    string;

    email:
    string;
  }
  |
  null;
}


interface DetailRow {
  key:
  string;

  label:
  string;

  before:
  string;

  after:
  string;
}


type AuditGroup =
  'all'
  |
  'users'
  |
  'watch'
  |
  'sources'
  |
  'taxonomy'
  |
  'actions'
  |
  'alerts'
  |
  'reports'
  |
  'access';


const logs =
  ref<AuditLog[]>([]);

const loading =
  ref(false);

const error =
  ref('');

const detailsVisible =
  ref(false);

const selectedLog =
  ref<AuditLog | null>(
    null,
  );

const userLabels =
  ref(
    new Map<
      number,
      string
    >(),
  );

const watchItemLabels =
  ref(
    new Map<
      number,
      string
    >(),
  );


const activeGroup =
  ref<AuditGroup>(
    'all',
  );


const auditGroups:
  Array<{
    key:
    AuditGroup;

    label:
    string;

    entities:
    string[];
  }> = [
    {
      key:
        'all',

      label:
        'Tout',

      entities:
        [],
    },

    {
      key:
        'users',

      label:
        'Utilisateurs',

      entities:
        [
          'users',
        ],
    },

    {
      key:
        'watch',

      label:
        'Veilles',

      entities:
        [
          'watch_items',
          'saved_views',
        ],
    },

    {
      key:
        'sources',

      label:
        'Sources',

      entities:
        [
          'sources',
          'connectors',
          'collection_runs',
        ],
    },

    {
      key:
        'taxonomy',

      label:
        'Taxonomie',

      entities:
        [
          'topics',
          'domains',
          'laboratories',
          'keywords',
          'keyword_synonyms',
        ],
    },

    {
      key:
        'actions',

      label:
        'Actions',

      entities:
        [
          'follow_up_actions',
        ],
    },

    {
      key:
        'alerts',

      label:
        'Alertes',

      entities:
        [
          'subscriptions',
          'notifications',
        ],
    },

    {
      key:
        'reports',

      label:
        'Rapports',

      entities:
        [
          'reports',
        ],
    },

    {
      key:
        'access',

      label:
        'Connexions',

      entities:
        [
          'auth',
        ],
    },
  ];


const filteredLogs =
  computed(
    () => {
      const group =
        auditGroups.find(
          (
            item,
          ) =>
            item.key ===
            activeGroup.value,
        );


      if (
        !group
        ||
        group.key ===
        'all'
      ) {
        return logs.value;
      }


      return logs.value.filter(
        (
          log,
        ) =>
          group.entities.includes(
            log.entity,
          ),
      );
    },
  );


const actionLabels:
  Record<
    string,
    string
  > = {

  LOGIN:
    'Connexion',

  LOGIN_FAILED:
    'Échec de connexion',

  LOGOUT:
    'Déconnexion',

  RESET_PASSWORD:
    'Modification du mot de passe',

  CHANGE_PASSWORD:
    'Changement de mot de passe',

  RESET_USER_PASSWORD_TEMPORARY:
    'Génération d’un mot de passe temporaire',

  CREATE_USER:
    'Création d’un utilisateur',

  ACTIVATE_USER:
    'Activation d’un utilisateur',

  DEACTIVATE_USER:
    'Désactivation d’un utilisateur',

  UPDATE_USER_ROLES:
    'Modification des rôles',

  CREATE_SOURCE:
    'Création d’une source',

  UPDATE_SOURCE:
    'Modification d’une source',

  ACTIVATE_SOURCE:
    'Activation d’une source',

  DEACTIVATE_SOURCE:
    'Désactivation d’une source',

  CREATE_CONNECTOR:
    'Création d’un connecteur',

  TEST_CONNECTOR:
    'Test d’un connecteur',

  RUN_COLLECTION:
    'Lancement d’une collecte',

  AUTO_COLLECTION:
    'Collecte automatique',

  RETRY_COLLECTION:
    'Relance d’une collecte',

  IMPORT_MANUAL_ITEMS:
    'Import manuel d’éléments de veille',

  QUALIFY_WATCH_ITEM:
    'Qualification d’une veille',

  AI_ANALYSIS_PROPOSED:
    'Proposition d’analyse par IA',

  AI_ANALYSIS_REVIEWED:
    'Relecture humaine d’une analyse IA',

  VALIDATE_WATCH_ITEM:
    'Validation d’une veille',

  REJECT_WATCH_ITEM:
    'Rejet d’une veille',

  PUBLISH_WATCH_ITEM:
    'Publication d’une veille',

  ARCHIVE_WATCH_ITEM:
    'Archivage d’une veille',

  CREATE_FOLLOW_UP_ACTION:
    'Création d’une action de suivi',

  UPDATE_FOLLOW_UP_ACTION:
    'Modification d’une action de suivi',

  DELETE_FOLLOW_UP_ACTION:
    'Suppression d’une action de suivi',

  CREATE_TOPIC:
    'Création d’un thème',

  UPDATE_TOPIC:
    'Modification d’un thème',

  DELETE_TOPIC:
    'Suppression d’un thème',

  CREATE_DOMAIN:
    'Création d’un domaine',

  UPDATE_DOMAIN:
    'Modification d’un domaine',

  DELETE_DOMAIN:
    'Suppression d’un domaine',

  CREATE_LABORATORY:
    'Création d’un laboratoire',

  UPDATE_LABORATORY:
    'Modification d’un laboratoire',

  DELETE_LABORATORY:
    'Suppression d’un laboratoire',

  CREATE_KEYWORD:
    'Création d’un mot-clé',

  UPDATE_KEYWORD:
    'Modification d’un mot-clé',

  DELETE_KEYWORD:
    'Suppression d’un mot-clé',

  CREATE_KEYWORD_SYNONYM:
    'Création d’un synonyme',

  UPDATE_KEYWORD_SYNONYM:
    'Modification d’un synonyme',

  DELETE_KEYWORD_SYNONYM:
    'Suppression d’un synonyme',

  ADD_FAVORITE:
    'Ajout d’une veille aux favoris',

  REMOVE_FAVORITE:
    'Retrait d’une veille des favoris',

  CREATE_SAVED_VIEW:
    'Création d’une vue enregistrée',

  DELETE_SAVED_VIEW:
    'Suppression d’une vue enregistrée',

  CREATE_SUBSCRIPTION:
    'Création d’un abonnement',

  DELETE_SUBSCRIPTION:
    'Suppression d’un abonnement',

  READ_NOTIFICATION:
    'Lecture d’une notification',

  GENERATE_REPORT:
    'Génération d’un rapport',

  DOWNLOAD_REPORT:
    'Téléchargement d’un rapport',
};


const entityLabels:
  Record<
    string,
    string
  > = {

  auth:
    'Authentification',

  users:
    'Utilisateurs',

  sources:
    'Sources',

  connectors:
    'Connecteurs',

  collection_runs:
    'Collectes',

  watch_items:
    'Veilles',

  follow_up_actions:
    'Actions de suivi',

  topics:
    'Thèmes',

  domains:
    'Domaines',

  laboratories:
    'Laboratoires',

  keywords:
    'Mots-clés',

  keyword_synonyms:
    'Synonymes',

  saved_views:
    'Vues enregistrées',

  subscriptions:
    'Abonnements',

  notifications:
    'Notifications',

  reports:
    'Rapports',
};


const fieldLabels:
  Record<
    string,
    string
  > = {

  id:
    'Identifiant',

  firstName:
    'Prénom',

  lastName:
    'Nom',

  email:
    'Adresse électronique',

  status:
    'Statut',

  mustChangePassword:
    'Changement de mot de passe requis',

  roles:
    'Rôles',

  name:
    'Nom',

  label:
    'Libellé',

  description:
    'Description',

  active:
    'Actif',

  organization:
    'Organisme',

  country:
    'Pays',

  category:
    'Catégorie',

  sourceType:
    'Type de source',

  baseUrl:
    'Adresse de la source',

  frequency:
    'Fréquence',

  connectorId:
    'Connecteur',

  runId:
    'Collecte',

  source:
    'Source',

  received:
    'Éléments reçus',

  created:
    'Nouveaux éléments',

  updated:
    'Éléments mis à jour',

  duplicates:
    'Doublons',

  errors:
    'Erreurs',

  error:
    'Message d’erreur',

  watchType:
    'Type de veille',

  relevance:
    'Pertinence',

  criticality:
    'Criticité',

  domainIds:
    'Domaines',

  laboratoryIds:
    'Laboratoires',

  topicIds:
    'Thèmes',

  keywordIds:
    'Mots-clés',

  title:
    'Titre',

  actionType:
    'Type d’action',

  owner:
    'Responsable',

  ownerId:
    'Responsable',

  dueDate:
    'Échéance',

  impact:
    'Impact',

  comment:
    'Commentaire',

  decision:
    'Décision',

  weight:
    'Poids',

  parentId:
    'Thème parent',

  keywordId:
    'Mot-clé',

  periodicity:
    'Périodicité',

  format:
    'Format',

  downloaded:
    'Téléchargement effectué',

  message:
    'Message',

  createdAt:
    'Date de création',

  updatedAt:
    'Date de modification',

  publishedAt:
    'Date de publication',

  user:
    'Utilisateur',

  userId:
    'Utilisateur',

  success:
    'Opération réussie',

  count:
    'Nombre d’éléments',

  result:
    'Résultat',

  connectorType:
    'Type de connecteur',

  config:
    'Configuration',

  lastTestAt:
    'Dernier test',

  watchItem:
    'Veille',

  watchItemId:
    'Veille',

  filters:
    'Filtres',

  targetType:
    'Type d’abonnement',

  sourceId:
    'Source',

  topicId:
    'Thème',

  criticalityMin:
    'Criticité minimale',

  notificationChannel:
    'Canal de notification',

  dateFrom:
    'Date de début',

  dateTo:
    'Date de fin',

  filePath:
    'Fichier',

  items:
    'Éléments',

  readAt:
    'Date de lecture',
};


const valueLabels:
  Record<
    string,
    string
  > = {

  ACTIVE:
    'Actif',

  INACTIVE:
    'Inactif',

  OPEN:
    'Ouverte',

  IN_PROGRESS:
    'En cours',

  RUNNING:
    'En cours',

  PENDING:
    'En attente',

  SENT:
    'Envoyé',

  FAILED:
    'Échoué',

  GENERATED:
    'Généré',

  DONE:
    'Terminée',

  COMPLETED:
    'Terminée',

  COMPLETED_WITH_ERRORS:
    'Terminée avec des erreurs',

  ERROR:
    'Erreur',

  NOUVEAU:
    'Nouveau',

  A_QUALIFIER:
    'À qualifier',

  VALIDE:
    'Validé',

  PUBLIE:
    'Publié',

  ARCHIVE:
    'Archivé',

  REJETE:
    'Rejeté',

  FAIBLE:
    'Faible',

  MOYENNE:
    'Moyenne',

  ELEVEE:
    'Élevée',

  CRITIQUE:
    'Critique',

  ADMIN:
    'Administrateur',

  RESPONSABLE_VEILLE:
    'Responsable de veille',

  OPERATEUR_VEILLE:
    'Opérateur de veille',

  REFERENT_LABORATOIRE:
    'Référent de laboratoire',

  LECTEUR:
    'Lecteur',

  IMPORT_MANUEL:
    'Import manuel',

  RSS:
    'Flux RSS',

  ATOM:
    'Flux Atom',

  API:
    'Interface de données (API)',

  SCIENTIFIQUE:
    'Scientifique',

  REGLEMENTAIRE:
    'Réglementaire',

  TECHNIQUE:
    'Technique',

  AUTRE:
    'Autre',

  SOURCE:
    'Source',

  TOPIC:
    'Thème',

  EMAIL:
    'Courriel',
};


function formatDate(
  value:
    string,
) {
  return new Intl.DateTimeFormat(
    'fr-FR',

    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function fieldLabel(
  key:
    string,
) {
  if (
    fieldLabels[key]
  ) {
    return fieldLabels[key];
  }


  const text =
    key
      .replace(
        /([a-z])([A-Z])/g,
        '$1 $2',
      )
      .replace(
        /_/g,
        ' ',
      )
      .toLowerCase();


  return text
    .charAt(
      0,
    )
    .toUpperCase()
    +
    text.slice(
      1,
    );
}


function readableReference(
  value:
    unknown,

  key:
    string,
):
  string
  |
  null {

  const id =
    Number(
      value,
    );


  if (
    !Number.isInteger(
      id,
    )
    ||
    id <=
    0
  ) {
    return null;
  }


  if (
    [
      'ownerId',
      'userId',
      'reviewerId',
    ].includes(
      key,
    )
  ) {
    return userLabels.value.get(
      id,
    )
      ??
      null;
  }


  if (
    key ===
    'watchItemId'
  ) {
    return watchItemLabels.value.get(
      id,
    )
      ??
      null;
  }


  return null;
}


function formatDetailValue(
  value:
    unknown,

  key =
    '',
):
  string {

  if (
    value ===
    null
    ||
    value ===
    undefined
    ||
    value ===
    ''
  ) {
    return 'Non renseigné';
  }


  const reference =
    readableReference(
      value,
      key,
    );


  if (
    reference
  ) {
    return reference;
  }


  if (
    typeof value ===
    'boolean'
  ) {
    return value
      ? 'Oui'
      : 'Non';
  }


  if (
    typeof value ===
    'number'
  ) {
    return String(
      value,
    );
  }


  if (
    typeof value ===
    'string'
  ) {
    if (
      valueLabels[value]
    ) {
      return valueLabels[value];
    }


    if (
      (
        key.endsWith(
          'At',
        )
        ||
        key.endsWith(
          'Date',
        )
      )
      &&
      !Number.isNaN(
        Date.parse(
          value,
        ),
      )
    ) {
      return formatDate(
        value,
      );
    }


    return value;
  }


  if (
    Array.isArray(
      value,
    )
  ) {
    if (
      !value.length
    ) {
      return 'Aucun';
    }


    return value
      .map(
        (
          entry,
        ) =>
          formatDetailValue(
            entry,
            key,
          ),
      )
      .join(
        ', ',
      );
  }


  if (
    typeof value ===
    'object'
  ) {
    const object =
      value as
      Record<
        string,
        unknown
      >;


    const preferred =
      object.label
      ??
      object.name
      ??
      object.title
      ??
      object.email;


    if (
      preferred !=
      null
    ) {
      return formatDetailValue(
        preferred,
      );
    }


    return Object.entries(
      object,
    )
      .map(
        (
          [
            childKey,
            childValue,
          ],
        ) =>
          `${fieldLabel(childKey)} : ${formatDetailValue(childValue, childKey)}`,
      )
      .join(
        ' • ',
      );
  }


  return String(
    value,
  );
}


function asRecord(
  value:
    unknown,
):
  Record<
    string,
    unknown
  > {

  if (Array.isArray(value)) {
    return value.length ? { items: value } : {};
  }

  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return value === null || value === undefined || value === ''
    ? {}
    : { result: value };
}


function auditEntityDisplay(
  log:
    AuditLog,
):
  string {

  if (
    log.entityDisplay
  ) {
    return log.entityDisplay;
  }


  const values = {
    ...asRecord(
      log.beforeValue,
    ),

    ...asRecord(
      log.afterValue,
    ),
  };


  const storedLabel =
    values.title
    ??
    values.name
    ??
    values.label;


  if (
    typeof storedLabel ===
    'string'
    &&
    storedLabel.trim()
  ) {
    return storedLabel;
  }


  if (
    log.entity ===
    'users'
    &&
    log.entityId
  ) {
    return userLabels.value.get(
      log.entityId,
    )
      ??
      `n° ${log.entityId}`;
  }


  if (
    log.entity ===
    'watch_items'
    &&
    log.entityId
  ) {
    return watchItemLabels.value.get(
      log.entityId,
    )
      ??
      `n° ${log.entityId}`;
  }


  return log.entityId
    ? String(
      log.entityId,
    )
    : '—';
}


const hasBefore =
  computed(
    () =>
      Object.keys(
        asRecord(
          selectedLog.value
            ?.beforeValue,
        ),
      ).length >
      0,
  );


const hasAfter =
  computed(
    () =>
      Object.keys(
        asRecord(
          selectedLog.value
            ?.afterValue,
        ),
      ).length >
      0,
  );


const detailTitle =
  computed(
    () => {
      if (
        hasBefore.value
        &&
        hasAfter.value
      ) {
        return 'Modifications apportées';
      }


      if (
        hasBefore.value
      ) {
        return 'Informations supprimées';
      }


      if (
        selectedLog.value
          ?.action
          .startsWith(
            'CREATE_',
          )
      ) {
        return 'Informations enregistrées';
      }


      return 'Résultat de l’opération';
    },
  );


const detailRows =
  computed<DetailRow[]>(
    () => {
      const before =
        asRecord(
          selectedLog.value
            ?.beforeValue,
        );

      const after =
        asRecord(
          selectedLog.value
            ?.afterValue,
        );


      const keys = [
        ...new Set([
          ...Object.keys(
            before,
          ),

          ...Object.keys(
            after,
          ),
        ]),
      ];


      return keys
        .filter(
          (
            key,
          ) =>
            !hasBefore.value
            ||
            !hasAfter.value
            ||
            JSON.stringify(
              before[key],
            )
            !==
            JSON.stringify(
              after[key],
            ),
        )
        .map(
          (
            key,
          ) => ({
            key,

            label:
              fieldLabel(
                key,
              ),

            before:
              formatDetailValue(
                before[key],
                key,
              ),

            after:
              formatDetailValue(
                after[key],
                key,
              ),
          }),
        );
    },
  );


function sourceOperationType(log: AuditLog): string {
  if (log.action === 'AUTO_COLLECTION' || (log.action === 'RUN_COLLECTION' && !log.user)) return 'Automatique';
  if (['RUN_COLLECTION', 'RETRY_COLLECTION', 'IMPORT_MANUAL_ITEMS', 'CREATE_SOURCE'].includes(log.action)) return 'Manuel';
  return '—';
}

function showDetails(
  log:
    AuditLog,
) {
  selectedLog.value =
    log;

  detailsVisible.value =
    true;
}


async function load() {
  loading.value =
    true;

  error.value =
    '';


  try {
    const [
      auditResult,
      usersResult,
      watchItemsResult,
    ] =
      await Promise.allSettled([
        getAuditLogs(),
        getUsers(),
        getWatchItems(),
      ]);


    if (
      auditResult.status ===
      'rejected'
    ) {
      throw auditResult.reason;
    }


    logs.value =
      auditResult.value.data;


    if (
      usersResult.status ===
      'fulfilled'
    ) {
      userLabels.value =
        new Map(
          usersResult.value.data.map(
            (
              user,
            ) => [
                user.id,

                `${user.firstName} ${user.lastName}`
                  .trim()
                ||
                user.email,
              ],
          ),
        );
    }


    if (
      watchItemsResult.status ===
      'fulfilled'
    ) {
      watchItemLabels.value =
        new Map(
          watchItemsResult.value.data.map(
            (
              item,
            ) => [
                item.id,
                item.title,
              ],
          ),
        );
    }

  } catch {
    error.value =
      'Impossible de charger le journal d’audit.';

  } finally {
    loading.value =
      false;
  }
}


onMounted(
  load,
);
</script>


<template>
  <AppLayout>

    <div class="audit-page">

      <PageHeader title="Journal d’audit" subtitle="Historique des opérations sensibles effectuées dans la plateforme."
        eyebrow="Administration" icon="pi pi-history" />


      <Message v-if="
        error
      " severity="error">
        {{ error }}
      </Message>


      <nav class="audit-navigation" aria-label="Filtrer le journal d’audit">

        <button v-for="
group in
              auditGroups
          " :key="group.key
            " type="button" class="audit-filter" :class="{
            active:
              activeGroup ===
              group.key,
          }" @click="
            activeGroup =
            group.key
            ">
          {{ group.label }}
        </button>

      </nav>


      <SectionCard :title="`${filteredLogs.length} opération${filteredLogs.length > 1 ? 's' : ''}`
        " subtitle="Toutes les actions importantes réalisées dans l’application." icon="pi pi-list">

        <DataTable :key="activeGroup
          " :value="filteredLogs
            " :loading="loading
            " paginator :rows="20
            " :rows-per-page-options="[
              10,
              20,
              50,
            ]
            " size="small">

          <template #empty>
            Aucune opération enregistrée dans cette partie.
          </template>


          <Column header="Action" style="min-width: 13rem">
            <template #body="{ data }">

              <strong class="action-name">
                {{
                  actionLabels[
                  data.action
                  ]
                  ??
                  data.action
                }}
              </strong>

            </template>
          </Column>


          <Column header="Élément">
            <template #body="{ data }">
              {{
                entityLabels[
                data.entity
                ]
                ??
                data.entity
              }}
            </template>
          </Column>


          <Column v-if="activeGroup === 'sources'" header="Type" style="width: 8rem">
            <template #body="{ data }">{{ sourceOperationType(data) }}</template>
          </Column>

          <Column v-if="activeGroup === 'reports'" header="Périmètre" style="min-width: 14rem">
            <template #body="{ data }">{{ data.reportScope ?? 'Non précisé' }}</template>
          </Column>

          <Column header="Identifiant" style="width: 7rem">
            <template #body="{ data }">
              {{
                data.entityId
                ??
                '—'
              }}
            </template>
          </Column>


          <Column header="Utilisateur" style="min-width: 11rem">
            <template #body="{ data }">

              <div class="audit-user">

                <div class="mini-avatar">
                  {{
                    data.user
                      ? (
                        `${data.user.firstName?.[0] ?? ''}${data.user.lastName?.[0] ?? ''}`
                      ).toUpperCase()
                      : 'S'
                  }}
                </div>

                <span>
                  {{
                    data.user
                      ? `${data.user.firstName} ${data.user.lastName}`
                      : 'Système'
                  }}
                </span>

              </div>

            </template>
          </Column>


          <Column header="Date" style="width: 10rem">
            <template #body="{ data }">
              <span class="date-text">
                {{
                  formatDate(
                    data.createdAt,
                  )
                }}
              </span>
            </template>
          </Column>


          <Column header="Détails" style="width: 5rem">
            <template #body="{ data }">

              <Button icon="pi pi-eye" severity="secondary" text rounded aria-label="Afficher les détails"
                title="Afficher les détails" @click="
                  showDetails(
                    data,
                  )
                  " />

            </template>
          </Column>

        </DataTable>

      </SectionCard>


      <Dialog v-model:visible="detailsVisible
        " modal header="Détails de l’opération" class="w-[min(92vw,760px)]">

        <div v-if="
          selectedLog
        " class="audit-detail">

          <div class="detail-summary">

            <div>
              <span>
                Action
              </span>

              <strong>
                {{
                  actionLabels[
                  selectedLog.action
                  ]
                  ??
                  selectedLog.action
                }}
              </strong>
            </div>


            <div>
              <span>
                Utilisateur
              </span>

              <strong>
                {{
                  selectedLog.user
                    ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}`
                    : 'Système'
                }}
              </strong>
            </div>


            <div>
              <span>
                Élément concerné
              </span>

              <strong>
                {{
                  entityLabels[
                  selectedLog.entity
                  ]
                  ??
                  selectedLog.entity
                }}

                :

                {{
                  auditEntityDisplay(
                    selectedLog,
                  )
                }}
              </strong>
            </div>


            <div>
              <span>
                Date
              </span>

              <strong>
                {{
                  formatDate(
                    selectedLog.createdAt,
                  )
                }}
              </strong>
            </div>

          </div>


          <div v-if="
            detailRows.length
          " class="detail-changes">

            <section v-if="
              hasBefore
            " class="detail-block before">

              <h3>
                Avant modification
              </h3>


              <div v-for="
row in
                    detailRows
                " :key="`before-${row.key}`
                  " class="detail-row">

                <span>
                  {{ row.label }}
                </span>

                <i class="pi pi-arrow-right" />

                <strong>
                  {{ row.before }}
                </strong>

              </div>

            </section>


            <section v-if="
              hasAfter
            " class="detail-block after">

              <h3>
                {{
                  hasBefore
                    ? 'Après modification'
                    : detailTitle
                }}
              </h3>


              <div v-for="
row in
                    detailRows
                " :key="`after-${row.key}`
                  " class="detail-row">

                <span>
                  {{ row.label }}
                </span>

                <i class="pi pi-arrow-right" />

                <strong>
                  {{ row.after }}
                </strong>

              </div>

            </section>

          </div>


          <p v-else class="no-detail">
            Aucune information complémentaire n’est disponible.
          </p>


          <p v-if="
            selectedLog.ipAddress
          " class="ip-address">
            Adresse réseau :
            {{ selectedLog.ipAddress }}
          </p>

        </div>

      </Dialog>

    </div>

  </AppLayout>
</template>


<style scoped>
.audit-page {
  display:
    grid;

  gap:
    1rem;
}

.audit-navigation {
  display:
    flex;

  width:
    100%;

  gap:
    0.35rem;

  overflow-x:
    auto;

  padding:
    0.35rem;

  border:
    1px solid var(--app-border);

  border-radius:
    0.8rem;

  background:
    var(--app-surface);
}

.audit-filter {
  flex:
    0 0 auto;

  border:
    0;

  border-radius:
    0.6rem;

  background:
    transparent;

  color:
    var(--app-text-muted);

  padding:
    0.5rem 0.75rem;

  font-size:
    0.68rem;

  font-weight:
    700;

  cursor:
    pointer;
}

.audit-filter:hover {
  background:
    var(--app-surface-2);

  color:
    var(--app-text-secondary);
}

.audit-filter.active {
  background:
    rgb(16 185 129 / 0.15);

  color:
    var(--app-primary);
}

.action-name {
  color:
    var(--app-text);

  font-size:
    0.72rem;
}

.audit-user {
  display:
    flex;

  align-items:
    center;

  gap:
    0.45rem;
}

.mini-avatar {
  display:
    grid;

  width:
    1.8rem;

  height:
    1.8rem;

  flex:
    0 0 1.8rem;

  place-items:
    center;

  border-radius:
    999px;

  background:
    var(--app-surface-strong);

  color:
    var(--app-primary);

  font-size:
    0.57rem;

  font-weight:
    800;
}

.audit-user span,
.date-text {
  color:
    var(--app-text-secondary);

  font-size:
    0.69rem;
}

.audit-detail {
  display:
    grid;

  gap:
    1rem;
}

.detail-summary {
  display:
    grid;

  grid-template-columns:
    repeat(2,
      minmax(0,
        1fr));

  gap:
    0.75rem;
}

.detail-summary>div {
  display:
    grid;

  gap:
    0.2rem;

  padding:
    0.7rem;

  border-radius:
    0.65rem;

  background:
    var(--app-surface-2);
}

.detail-summary span {
  color:
    var(--app-text-muted);

  font-size:
    0.62rem;

  font-weight:
    700;

  text-transform:
    uppercase;
}

.detail-summary strong {
  color:
    var(--app-text);

  font-size:
    0.72rem;

  overflow-wrap:
    anywhere;
}

.detail-changes {
  display:
    grid;

  gap:
    0.8rem;
}

.detail-block {
  overflow:
    hidden;

  border:
    1px solid var(--app-border);

  border-radius:
    0.7rem;

  background:
    var(--app-surface-2);
}

.detail-block.after {
  border-color:
    rgb(16 185 129 / 0.2);
}

.detail-block h3 {
  margin:
    0;

  padding:
    0.65rem 0.75rem;

  border-bottom:
    1px solid var(--app-border);

  color:
    var(--app-text);

  font-size:
    0.72rem;
}

.detail-block.after h3 {
  color:
    var(--app-primary);
}

.detail-row {
  display:
    grid;

  grid-template-columns:
    minmax(0,
      1fr) auto minmax(0,
      1fr);

  gap:
    0.6rem;

  align-items:
    start;

  padding:
    0.6rem 0.75rem;

  border-bottom:
    1px solid var(--app-border);
}

.detail-row:last-child {
  border-bottom:
    0;
}

.detail-row span {
  color:
    var(--app-text-muted);

  font-size:
    0.68rem;
}

.detail-row i {
  margin-top:
    0.15rem;

  color:
    var(--app-primary);

  font-size:
    0.6rem;
}

.detail-row strong {
  color:
    var(--app-text-secondary);

  font-size:
    0.68rem;

  text-align:
    right;

  overflow-wrap:
    anywhere;
}

.no-detail {
  margin:
    0;

  padding:
    0.75rem;

  border-radius:
    0.65rem;

  background:
    var(--app-surface-2);

  color:
    var(--app-text-muted);

  font-size:
    0.7rem;
}

.ip-address {
  margin:
    0;

  color:
    var(--app-text-muted);

  font-size:
    0.63rem;
}

@media (max-width: 620px) {
  .detail-summary {
    grid-template-columns:
      1fr;
  }

  .detail-row {
    grid-template-columns:
      1fr;
  }

  .detail-row i {
    display:
      none;
  }

  .detail-row strong {
    text-align:
      left;
  }
}
</style>
