<script setup lang="ts">
import {
    computed,
    onMounted,
    ref,
} from 'vue';

import {
    useRouter,
} from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';

import {
    useToast,
} from 'primevue/usetoast';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';

import {
    getAllActions,
    updateAction,
    type FollowUpAction,
} from '../services/actions.service';

import {
    labelFr,
} from '../i18n/labels';

import {
    useAuthStore,
} from '../stores/auth';

import {
    actionError,
    actionSuccess,
} from '../utils/action-toast';

import {
    statusSeverity,
} from '../utils/status-severity';


const router =
    useRouter();

const actions =
    ref<FollowUpAction[]>([]);

const loading =
    ref(false);

const auth =
    useAuthStore();

const toast =
    useToast();
const finishDialog = ref(false);
const finishingAction = ref<FollowUpAction | null>(null);
const finishProgressComment = ref('');
const finishResult = ref('');
const detailDialog = ref(false);
const detailAction = ref<FollowUpAction | null>(null);

function openFinishDialog(action: FollowUpAction) {
    finishingAction.value = action;
    finishProgressComment.value = action.progressComment ?? '';
    finishResult.value = action.result ?? '';
    finishDialog.value = true;
}

function openActionDetails(action: FollowUpAction) {
    detailAction.value = action;
    detailDialog.value = true;
}

const updating =
    ref<number[]>([]);


const isReferentOnly =
    computed(
        () =>
            auth.user?.roles.includes(
                'REFERENT_LABORATOIRE',
            )
            &&
            !auth.user?.roles.some(
                (
                    role,
                ) =>
                    [
                        'ADMIN',
                        'RESPONSABLE_VEILLE',
                    ].includes(
                        role,
                    ),
            ),
    );


const pageTitle =
    computed(
        () =>
            isReferentOnly.value
                ? 'Mes actions de suivi'
                : 'Actions de suivi',
    );


const openActions =
    computed(
        () =>
            actions.value.filter(
                (
                    action,
                ) =>
                    action.status ===
                    'OPEN',
            ).length,
    );


const inProgressActions =
    computed(
        () =>
            actions.value.filter(
                (
                    action,
                ) =>
                    action.status ===
                    'IN_PROGRESS',
            ).length,
    );


const doneActions =
    computed(
        () =>
            actions.value.filter(
                (
                    action,
                ) =>
                    action.status ===
                    'DONE',
            ).length,
    );

function isOverdue(action: FollowUpAction) {
    if (action.status === 'DONE' || !action.dueDate) {
        return false;
    }
    const dueStr = String(action.dueDate).slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    return dueStr < todayStr;
}

const overdueActions = computed(
    () => actions.value.filter((action) => isOverdue(action)).length,
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
        return 'Sans échéance';
    }

    const date =
        new Date(
            value,
        );

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return 'Sans échéance';
    }

    return new Intl.DateTimeFormat(
        'fr-FR',
        {
            dateStyle:
                'short',
        },
    ).format(
        date,
    );
}


async function load() {
    loading.value =
        true;

    try {
        actions.value =
            (
                await getAllActions()
            ).data;

    } finally {
        loading.value =
            false;
    }
}


async function updateStatus(
    action:
        FollowUpAction,

    status:
        string,
) {
    if (status === 'DONE') {
        openFinishDialog(action);
        return;
    }
    if (
        updating.value.includes(
            action.id,
        )
    ) {
        return;
    }


    updating.value.push(
        action.id,
    );


    try {
        await updateAction(
            action.id,
            {
                status,
            },
        );


        actionSuccess(
            toast,

            status ===
                'DONE'
                ? 'Action terminée'
                : 'Action démarrée',

            `L’action « ${action.title} » a été mise à jour.`,
        );


        await load();

    } catch (
    error
    ) {
        actionError(
            toast,
            error,
            'Modification impossible',
            'Le statut de l’action n’a pas pu être modifié.',
        );

    } finally {
        updating.value =
            updating.value.filter(
                (
                    id,
                ) =>
                    id !==
                    action.id,
            );
    }
}

async function confirmFinishAction() {
    const action = finishingAction.value;
    if (!action || updating.value.includes(action.id)) return;
    updating.value.push(action.id);
    try {
        await updateAction(action.id, {
            status: 'DONE',
            progressComment: finishProgressComment.value,
            result: finishResult.value,
        });
        finishDialog.value = false;
        actionSuccess(toast, 'Action terminée', `L’action « ${action.title} » a été clôturée.`);
        await load();
    } catch (error) {
        actionError(toast, error, 'Clôture impossible', 'Les informations de clôture n’ont pas pu être enregistrées.');
    } finally {
        updating.value = updating.value.filter((id) => id !== action.id);
    }
}


function ownerName(
    action:
        FollowUpAction,
) {
    return (
        `${action.owner?.firstName ?? ''} ${action.owner?.lastName ?? ''}`
            .trim()
        ||
        action.owner?.email
        ||
        'Non renseigné'
    );
}


onMounted(
    load,
);
</script>


<template>
    <AppLayout>

        <div class="actions-page">

            <PageHeader :title="pageTitle
                " subtitle="Suivi des actions à réaliser à la suite des informations de veille." eyebrow="Suivi"
                icon="pi pi-check-square" />


            <div class="action-stats">

                <div class="stat-item">

                    <span class="stat-icon open">
                        <i class="pi pi-clock" />
                    </span>

                    <div>
                        <strong>
                            {{ openActions }}
                        </strong>

                        <span>
                            À démarrer
                        </span>
                    </div>

                </div>


                <div class="stat-item">

                    <span class="stat-icon progress">
                        <i class="pi pi-spinner" />
                    </span>

                    <div>
                        <strong>
                            {{ inProgressActions }}
                        </strong>

                        <span>
                            En cours
                        </span>
                    </div>

                </div>


                <div class="stat-item">

                    <span class="stat-icon done">
                        <i class="pi pi-check" />
                    </span>

                    <div>
                        <strong>
                            {{ doneActions }}
                        </strong>

                        <span>
                            Terminées
                        </span>
                    </div>

                </div>

                <div class="stat-item">

                    <span class="stat-icon overdue">
                        <i class="pi pi-exclamation-triangle" />
                    </span>

                    <div>
                        <strong>
                            {{ overdueActions }}
                        </strong>

                        <span>
                            En retard
                        </span>
                    </div>

                </div>

            </div>


            <SectionCard :title="`${actions.length} action${actions.length > 1 ? 's' : ''}`
                " subtitle="Liste des actions de suivi associées aux éléments de veille." icon="pi pi-list">

                <DataTable :value="actions
                    " :loading="loading
                        " paginator :rows="10
                            " :rows-per-page-options="[
                    10,
                    20,
                    50,
                ]
                    ">

                    <template #empty>
                        Aucune action de suivi enregistrée.
                    </template>


                    <Column field="title" header="Action à réaliser" style="min-width: 13rem">
                        <template #body="{ data }">

                            <strong class="action-title">
                                {{ data.title }}
                            </strong>

                        </template>
                    </Column>


                    <Column header="Veille" style="min-width: 14rem">
                        <template #body="{ data }">

                            <button type="button" class="watch-link" @click="
                                router.push(
                                    `/watch-items/${data.watchItem.id}`,
                                )
                                ">
                                {{
                                    data.watchItem?.title
                                }}
                            </button>

                        </template>
                    </Column>


                    <Column header="Type">
                        <template #body="{ data }">
                            {{
                                labelFr(
                                    data.actionType,
                                )
                            }}
                        </template>
                    </Column>


                    <Column header="Responsable">
                        <template #body="{ data }">
                            {{
                                ownerName(
                                    data,
                                )
                            }}
                        </template>
                    </Column>


                    <Column header="Échéance" style="width: 11rem">
                        <template #body="{ data }">
                            <div class="due-date-cell">
                                <span class="date-text">
                                    {{
                                        formatDate(
                                            data.dueDate,
                                        )
                                    }}
                                </span>
                                <Tag v-if="isOverdue(data)" value="En retard" severity="danger" />
                            </div>
                        </template>
                    </Column>


                    <Column header="Statut" style="width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="labelFr(
                                data.status,
                            )
                                " :severity="statusSeverity(
                                    data.status,
                                )
                                    " />
                        </template>
                    </Column>


                    <Column header="Détails du suivi" style="min-width: 17rem">
                        <template #body="{ data }">
                            <div class="action-follow-up">
                                <span v-if="data.progressComment"><strong>Avancement :</strong> {{ data.progressComment
                                }}</span>
                                <span v-if="data.result"><strong>Résultat :</strong> {{ data.result }}</span>
                                <span v-if="data.startedAt">Début : {{ formatDate(data.startedAt) }}</span>
                                <span v-if="data.completedAt">Clôture : {{ formatDate(data.completedAt) }}</span>
                                <span
                                    v-if="!data.progressComment && !data.result && !data.startedAt && !data.completedAt"
                                    class="muted-follow-up">Aucun détail renseigné</span>
                            </div>
                            <Button v-if="data.status === 'DONE'" label="Voir les détails" icon="pi pi-eye" text size="small"
                                class="details-button" @click="openActionDetails(data)" />
                        </template>
                    </Column>

                    <Column header="Mise à jour" style="width: 9rem">
                        <template #body="{ data }">

                            <Button v-if="
                                data.status ===
                                'OPEN'
                            " label="Démarrer" size="small" :loading="updating.includes(
                                data.id,
                            )
                                " @click="
                                    updateStatus(
                                        data,
                                        'IN_PROGRESS',
                                    )
                                    " />


                            <Button v-else-if="
                                data.status ===
                                'IN_PROGRESS'
                            " label="Terminer" size="small" severity="success" :loading="updating.includes(
                                data.id,
                            )
                                " @click="
                                    updateStatus(
                                        data,
                                        'DONE',
                                    )
                                    " />


                            <span v-else class="completed-text">
                                Terminée
                            </span>

                        </template>
                    </Column>

                </DataTable>

            </SectionCard>

        </div>

        <Dialog v-model:visible="finishDialog" modal header="Terminer l’action" class="w-full max-w-xl">
            <p v-if="finishingAction">Renseignez les informations réalisées pour « {{ finishingAction.title }} » avant
                de
                confirmer sa clôture.</p>
            <div class="finish-fields">
                <div>
                    <label>Commentaire d’avancement</label>
                    <Textarea v-model="finishProgressComment" rows="4" class="w-full"
                        placeholder="Décrivez le travail effectué..." />
                </div>
                <div>
                    <label>Résultat ou conclusion</label>
                    <Textarea v-model="finishResult" rows="4" class="w-full"
                        placeholder="Indiquez le résultat obtenu ou la conclusion..." />
                </div>
            </div>
            <template #footer>
                <Button label="Annuler" severity="secondary" text @click="finishDialog = false" />
                <Button label="Valider et terminer" icon="pi pi-check" severity="success"
                    :loading="finishingAction ? updating.includes(finishingAction.id) : false"
                    @click="confirmFinishAction" />
            </template>
        </Dialog>

        <Dialog v-model:visible="detailDialog" modal header="Détails de l'action" class="w-full max-w-xl">
            <div v-if="detailAction" class="action-detail-dialog">
                <h3>{{ detailAction.title }}</h3>
                <p v-if="detailAction.watchItem"><strong>Veille :</strong> {{ detailAction.watchItem.title }}</p>
                <div class="detail-status"><strong>Statut :</strong><Tag :value="labelFr(detailAction.status)"
                    :severity="statusSeverity(detailAction.status)" /></div>
                <dl class="detail-grid">
                    <div><dt>Type</dt><dd>{{ labelFr(detailAction.actionType) }}</dd></div>
                    <div><dt>Échéance</dt><dd>{{ formatDate(detailAction.dueDate) }}</dd></div>
                    <div><dt>Début</dt><dd>{{ formatDate(detailAction.startedAt) }}</dd></div>
                    <div><dt>Clôture</dt><dd>{{ formatDate(detailAction.completedAt) }}</dd></div>
                </dl>
                <div v-if="detailAction.progressComment" class="detail-block"><strong>Commentaire d’avancement</strong>
                    <p>{{ detailAction.progressComment }}</p></div>
                <div v-if="detailAction.result" class="detail-block"><strong>Résultat ou conclusion</strong>
                    <p>{{ detailAction.result }}</p></div>
                <p v-if="!detailAction.progressComment && !detailAction.result && !detailAction.startedAt && !detailAction.completedAt"
                    class="muted-follow-up">Aucun détail renseigné pour le moment.</p>
            </div>
        </Dialog>

    </AppLayout>
</template>


<style scoped>
.finish-fields {
    display: grid;
    gap: 1rem;
}

.action-follow-up {
    display: grid;
    gap: .25rem;
    white-space: normal;
    font-size: .82rem;
    line-height: 1.35;
}

.action-follow-up span {
    overflow-wrap: anywhere;
}

.muted-follow-up {
    color: var(--app-text-secondary);
}

.details-button { margin-top: .35rem; padding-left: 0; }
.action-detail-dialog { display: grid; gap: 1rem; }
.action-detail-dialog h3 { margin: 0; color: var(--app-text-primary); }
.action-detail-dialog p { margin: 0; line-height: 1.5; }
.detail-status { display: flex; align-items: center; gap: .6rem; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; margin: 0; }
.detail-grid dt { color: var(--app-text-secondary); font-size: .78rem; font-weight: 700; }
.detail-grid dd { margin: .2rem 0 0; }
.detail-block { padding: .8rem; border: 1px solid var(--app-border); border-radius: .65rem; background: var(--app-surface); }
.detail-block p { margin-top: .35rem; white-space: pre-wrap; }

.finish-fields label {
    display: block;
    margin-bottom: .4rem;
    font-weight: 700;
    color: var(--app-text-secondary);
}

.actions-page {
    display:
        grid;

    gap:
        1rem;
}

.action-stats {
    display:
        grid;

    grid-template-columns:
        repeat(4,
            minmax(0,
                1fr));

    gap:
        0.7rem;
}

.stat-item {
    display:
        flex;

    align-items:
        center;

    gap:
        0.7rem;

    padding:
        0.8rem 0.9rem;

    border:
        1px solid var(--app-border);

    border-radius:
        0.8rem;

    background:
        var(--app-surface);
}

.stat-icon {
    display:
        grid;

    width:
        2.2rem;

    height:
        2.2rem;

    place-items:
        center;

    border-radius:
        0.65rem;
}

.stat-icon.open {
    background:
        rgb(245 158 11 / 0.12);

    color:
        #fbbf24;
}

.stat-icon.progress {
    background:
        rgb(59 130 246 / 0.12);

    color:
        #60a5fa;
}

.stat-icon.done {
    background:
        rgb(16 185 129 / 0.12);

    color:
        #34d399;
}

.stat-icon.overdue {
    background:
        rgb(239 68 68 / 0.14);

    color:
        #f87171;
}

.due-date-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
}

.stat-item strong {
    display:
        block;

    color:
        var(--app-text);

    font-size:
        1.1rem;
}

.stat-item span:not(.stat-icon) {
    color:
        var(--app-text-muted);

    font-size:
        0.65rem;
}

.action-title {
    color:
        var(--app-text);

    font-size:
        0.74rem;
}

.watch-link {
    border:
        0;

    background:
        transparent;

    color:
        var(--app-blue);

    font-size:
        0.72rem;

    font-weight:
        650;

    text-align:
        left;

    cursor:
        pointer;
}

.watch-link:hover {
    color:
        #93c5fd;
}

.date-text,
.completed-text {
    color:
        var(--app-text-muted);

    font-size:
        0.68rem;
}

@media (max-width: 700px) {
    .action-stats {
        grid-template-columns:
            1fr;
    }
}
</style>
