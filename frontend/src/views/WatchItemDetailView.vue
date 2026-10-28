<script setup lang="ts">
import {
    computed,
    onMounted,
    ref,
} from 'vue';

import {
    useRoute,
    useRouter,
} from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

import {
    useToast,
} from 'primevue/usetoast';

import ArrowLeftIcon
    from '@primeicons/vue/arrow-left';

import PlusIcon
    from '@primeicons/vue/plus';

import PencilIcon
    from '@primeicons/vue/pencil';

import SearchIcon
    from '@primeicons/vue/search';

import TrashIcon
    from '@primeicons/vue/trash';

import AppLayout
    from '../layouts/AppLayout.vue';

import PageHeader
    from '../components/ui/PageHeader.vue';

import SectionCard
    from '../components/ui/SectionCard.vue';
import { safeExternalUrl } from '../utils/safe-external-url';

import StatusBadge
    from '../components/ui/StatusBadge.vue';

import {
    labelFr,
    optionsFr,
} from '../i18n/labels';

import {
    useAuthStore,
} from '../stores/auth';

import {
    getWatchItem,
    translateWatchItemToEnglish,
    type WatchItem,
} from '../services/watch-items.service';

import {
    archiveWatchItem,
    getReviews,
    publishWatchItem,
    reviewWatchItem,
    type Review,
} from '../services/validation.service';

import {
    createAction,
    deleteAction,
    getActions,
    updateAction,
    type FollowUpAction,
} from '../services/actions.service';

import {
    getUsers,
    type AssignableUser,
} from '../services/users.service';

import {
    actionError as showActionError,
    actionSuccess,
} from '../utils/action-toast';

import {
    clampInteger,
} from '../utils/numeric-input';

import {
    getPriorityColor,
    getPriorityLabel,
} from '../utils/priority';


/* =====================================================
 * ROUTER / AUTH / TOAST
 * ===================================================== */

const route =
    useRoute();

const router =
    useRouter();

function returnToWatchItems() {
    const candidate = route.query.returnTo;
    if (typeof candidate === 'string') {
        const target = router.resolve(candidate);
        if (target.path === '/watch-items') {
            void router.push(target.fullPath);
            return;
        }
    }
    void router.push('/watch-items');
}

const auth =
    useAuthStore();

const toast =
    useToast();


const item =
    ref<WatchItem | null>(
        null,
    );

const displayLanguage = ref<'fr' | 'original' | 'en'>('fr');
const translatingToEnglish = ref(false);
const summaryExpanded = ref(false);

const itemOriginalLanguage = computed(() => item.value?.originalLanguage ?? item.value?.language ?? '');
const sourceWasFrench = computed(() => /^fr(?:-|$)/i.test(itemOriginalLanguage.value));
const availableDisplayLanguages = computed(() => {
    if (!item.value) return [];
    if (sourceWasFrench.value) return ['fr', 'en'] as const;
    if (item.value.originalTitle && item.value.frenchTitle) return ['fr', 'original'] as const;
    return [];
});
const displayedTitle = computed(() => {
    if (!item.value) return '';
    if (displayLanguage.value === 'original') return item.value.originalTitle ?? item.value.title;
    if (displayLanguage.value === 'en') return item.value.englishTitle ?? item.value.title;
    return item.value.frenchTitle ?? item.value.title;
});
const displayedTitleHtml = computed(() => displayedTitle.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/em&gt;/gi, '</em>'));
const displayedSummary = computed(() => {
    if (!item.value) return null;
    if (displayLanguage.value === 'original') return item.value.originalSummary ?? item.value.summary;
    if (displayLanguage.value === 'en') return item.value.englishSummary ?? item.value.summary;
    return item.value.frenchSummary ?? item.value.summary;
});
const summaryCanExpand = computed(() => (displayedSummary.value?.length ?? 0) > 350);

async function selectDisplayLanguage(language: 'fr' | 'original' | 'en') {
    if (!item.value) return;
    if (language === 'en' && !item.value.englishTitle) {
        translatingToEnglish.value = true;
        try {
            item.value = (await translateWatchItemToEnglish(item.value.id)).data;
        } catch (e: any) {
            showActionError(toast, e, 'Traduction indisponible', 'La traduction anglaise n’a pas pu être chargée.');
            return;
        } finally {
            translatingToEnglish.value = false;
        }
    }
    displayLanguage.value = language;
    summaryExpanded.value = false;
}

const reviews =
    ref<Review[]>([]);

const actions =
    ref<FollowUpAction[]>([]);

const users =
    ref<AssignableUser[]>([]);

const usersLoading =
    ref(false);

const loading =
    ref(false);

const error =
    ref('');

const success =
    ref('');


/* =====================================================
 * RÔLES / PERMISSIONS
 * ===================================================== */

const roles =
    computed(
        () =>
            auth.user?.roles
            ??
            [],
    );


const canValidate =
    computed(
        () =>
            roles.value.includes(
                'ADMIN',
            )
            ||
            roles.value.includes(
                'RESPONSABLE_VEILLE',
            ),
    );


const canCreateAction =
    computed(
        () =>
            roles.value.includes(
                'ADMIN',
            )
            ||
            roles.value.includes(
                'RESPONSABLE_VEILLE',
            )
            ||
            roles.value.includes(
                'REFERENT_LABORATOIRE',
            ),
    );


const canViewReviews =
    computed(
        () =>
            [
                'ADMIN',
                'RESPONSABLE_VEILLE',
                'REFERENT_LABORATOIRE',
                'OPERATEUR_VEILLE',
            ].some(
                (
                    role,
                ) =>
                    roles.value.includes(
                        role,
                    ),
            ),
    );


/* =====================================================
 * ID DE LA VEILLE
 * ===================================================== */

const itemId =
    computed(
        () =>
            Number(
                route.params.id,
            ),
    );


/* =====================================================
 * UTILISATEURS
 * ===================================================== */

const userOptions =
    computed(
        () =>
            users.value.map(
                (
                    user,
                ) => ({
                    id:
                        user.id,

                    label:
                        `${user.firstName ?? ''} ${user.lastName ?? ''}`
                            .trim()
                        ||
                        user.email,
                }),
            ),
    );


/* =====================================================
 * REVIEW / VALIDATION
 * ===================================================== */

const reviewDialog =
    ref(false);

const reviewDecision =
    ref<
        'VALIDATE'
        |
        'REJECT'
    >(
        'VALIDATE',
    );


const reviewForm =
    ref({
        relevance:
            0,

        comment:
            '',
    });


const reviewPriorityScore =
    computed({
        get:
            () =>
                reviewForm.value.relevance,

        set:
            (
                value:
                    number,
            ) => {
                reviewForm.value.relevance =
                    clampInteger(
                        value,
                        0,
                        100,
                    )
                    ??
                    0;
            },
    });


const reviewPriorityLabel =
    computed(
        () =>
            getPriorityLabel(
                reviewPriorityScore.value,
            ),
    );


const reviewPriorityColor =
    computed(
        () =>
            getPriorityColor(
                reviewPriorityScore.value,
            ),
    );


/* =====================================================
 * ACTIONS
 * ===================================================== */

const actionDialog =
    ref(false);

const actionTypes = [
    'ANALYSE_IMPACT',
    'MISE_A_JOUR_METHODE',
    'FORMATION',
    'VERIFICATION',
    'AUTRE',
];


const actionForm =
    ref({
        title:
            '',

        description:
            '',

        actionType:
            'ANALYSE_IMPACT',

        impact:
            '',

        progressComment:
            '',

        result:
            '',

        dueDate:
            '',

        ownerId:
            null as number | null,
    });


const actionError =
    ref('');

const actionSubmitting =
    ref(false);


/* =====================================================
 * RECHERCHES
 * ===================================================== */

const reviewSearch =
    ref('');

const actionSearch =
    ref('');


/* =====================================================
 * MODIFICATION ACTION
 * ===================================================== */

const editActionDialog =
    ref(false);

const editingAction =
    ref<FollowUpAction | null>(
        null,
    );

const editActionError =
    ref('');

const editActionSubmitting =
    ref(false);


const editActionForm =
    ref({
        title:
            '',

        description:
            '',

        actionType:
            'ANALYSE_IMPACT',

        impact:
            '',

        progressComment:
            '',

        result:
            '',

        dueDate:
            '',

        ownerId:
            null as number | null,
    });


/* =====================================================
 * SUPPRESSION ACTION
 * ===================================================== */

const deleteActionDialog =
    ref(false);

const actionToDelete =
    ref<FollowUpAction | null>(
        null,
    );

const actionDeleting =
    ref(false);


/* =====================================================
 * FORMATAGE DATE
 * ===================================================== */

const dateTimeFormatter =
    new Intl.DateTimeFormat(
        'fr-FR',
        {
            day:
                '2-digit',

            month:
                '2-digit',

            year:
                'numeric',

            hour:
                '2-digit',

            minute:
                '2-digit',
        },
    );


const dateFormatter =
    new Intl.DateTimeFormat(
        'fr-FR',
        {
            day:
                '2-digit',

            month:
                '2-digit',

            year:
                'numeric',
        },
    );


function formatDate(
    value:
        string
        |
        null
        |
        undefined,

    includeTime =
        true,
): string {
    if (
        !value
    ) {
        return 'Non renseignée';
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
        return 'Non renseignée';
    }

    return includeTime
        ? dateTimeFormatter.format(
            date,
        )
        : dateFormatter.format(
            date,
        );
}


/* =====================================================
 * RECHERCHE NORMALISÉE
 * ===================================================== */

function normalizeSearch(
    value:
        unknown,
): string {
    return String(
        value
        ??
        '',
    )
        .normalize(
            'NFD',
        )
        .replace(
            /[\u0300-\u036f]/g,
            '',
        )
        .toLocaleLowerCase(
            'fr-FR',
        );
}


/* =====================================================
 * FILTRAGE HISTORIQUE
 * ===================================================== */

const filteredReviews =
    computed(
        () => {
            const query =
                normalizeSearch(
                    reviewSearch.value.trim(),
                );

            if (
                !query
            ) {
                return reviews.value;
            }

            return reviews.value.filter(
                (
                    review,
                ) =>
                    [
                        labelFr(
                            review.status,
                        ),

                        labelFr(
                            review.criticality,
                        ),

                        review.relevance,

                        review.comment,

                        review.reviewer
                            ?.firstName,

                        review.reviewer
                            ?.lastName,

                        review.reviewer
                            ?.email,

                        formatDate(
                            review.reviewedAt,
                        ),
                    ].some(
                        (
                            value,
                        ) =>
                            normalizeSearch(
                                value,
                            ).includes(
                                query,
                            ),
                    ),
            );
        },
    );


/* =====================================================
 * FILTRAGE ACTIONS
 * ===================================================== */

const filteredActions =
    computed(
        () => {
            const query =
                normalizeSearch(
                    actionSearch.value.trim(),
                );

            if (
                !query
            ) {
                return actions.value;
            }

            return actions.value.filter(
                (
                    action,
                ) =>
                    [
                        action.title,

                        action.description,

                        labelFr(
                            action.actionType,
                        ),

                        action.impact,

                        action.owner
                            ?.firstName,

                        action.owner
                            ?.lastName,

                        action.owner
                            ?.email,

                        labelFr(
                            action.status,
                        ),

                        formatDate(
                            action.dueDate,
                            false,
                        ),
                    ].some(
                        (
                            value,
                        ) =>
                            normalizeSearch(
                                value,
                            ).includes(
                                query,
                            ),
                    ),
            );
        },
    );


/* =====================================================
 * AUTORISATION CRÉATION ACTION
 * ===================================================== */

const canCreateActionForCurrentStatus =
    computed(
        () =>
            canCreateAction.value
            &&
            Boolean(
                item.value
                &&
                [
                    'A_QUALIFIER',
                    'VALIDE',
                    'PUBLIE',
                ].includes(
                    item.value.status,
                ),
            ),
    );


const actionCreationHelp =
    computed(
        () => {
            switch (
            item.value?.status
            ) {
                case 'NOUVEAU':
                    return 'Cette veille doit d’abord être qualifiée avant de pouvoir créer une action de suivi.';

                case 'REJETE':
                    return 'Une action de suivi ne peut pas être créée pour une veille rejetée.';

                case 'ARCHIVE':
                    return 'Une action de suivi ne peut pas être créée pour une veille archivée.';

                default:
                    return 'La création d’une action est autorisée pour les veilles à qualifier, validées ou publiées.';
            }
        },
    );


/* =====================================================
 * AFFICHAGE PRIORITÉ
 * ===================================================== */

const currentPriorityLabel =
    computed(
        () => {
            if (
                item.value?.relevance ===
                null
                ||
                item.value?.relevance ===
                undefined
            ) {
                return 'Non qualifiée';
            }

            return getPriorityLabel(
                item.value.relevance,
            );
        },
    );


const currentPriorityColor =
    computed(
        () => {
            if (
                item.value?.relevance ===
                null
                ||
                item.value?.relevance ===
                undefined
            ) {
                return '#94a3b8';
            }

            return getPriorityColor(
                item.value.relevance,
            );
        },
    );


/* =====================================================
 * STATUT ACTION
 * ===================================================== */

function actionStatusSeverity(
    status:
        string,
) {
    switch (
    status
    ) {
        case 'DONE':
            return 'success';

        case 'IN_PROGRESS':
            return 'info';

        case 'CANCELLED':
            return 'secondary';

        case 'OPEN':
            return 'warn';

        default:
            return 'secondary';
    }
}


/* =====================================================
 * GESTION ACTION
 * ===================================================== */

function canManageAction(
    action:
        FollowUpAction,
) {
    if (
        roles.value.includes(
            'ADMIN',
        )
        ||
        roles.value.includes(
            'RESPONSABLE_VEILLE',
        )
    ) {
        return true;
    }

    return (
        roles.value.includes(
            'REFERENT_LABORATOIRE',
        )
        &&
        action.owner?.id ===
        auth.user?.id
    );
}


function actionOwnerName(
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


/* =====================================================
 * CHARGEMENT
 * ===================================================== */

async function load() {
    loading.value =
        true;

    error.value =
        '';

    try {
        const itemResponse =
            await getWatchItem(
                itemId.value,
            );

        item.value =
            itemResponse.data;


        reviews.value =
            canViewReviews.value
                ? (
                    await getReviews(
                        itemId.value,
                    )
                ).data
                : [];


        if (
            canCreateAction.value
        ) {
            actions.value =
                (
                    await getActions(
                        itemId.value,
                    )
                ).data;

            try {
                users.value =
                    (
                        await getUsers()
                    ).data;
            } catch {
                users.value =
                    [];
            }
        }

    } catch (
    e:
        any
    ) {
        error.value =
            e.response
                ?.data
                ?.message
            ??
            'Impossible de charger la veille.';
    } finally {
        loading.value =
            false;
    }
}


/* =====================================================
 * UTILISATEURS ASSIGNABLES
 * ===================================================== */

async function loadAssignableUsers() {
    usersLoading.value =
        true;

    try {
        users.value =
            (
                await getUsers()
            ).data;
    } catch (
    e:
        any
    ) {
        users.value =
            [];

        actionError.value =
            e.response
                ?.data
                ?.message
            ??
            'Impossible de charger la liste des responsables.';
    } finally {
        usersLoading.value =
            false;
    }
}


/* =====================================================
 * OUVRIR CRÉATION ACTION
 * ===================================================== */

async function openActionDialog() {
    error.value =
        '';

    actionError.value =
        '';

    actionDialog.value =
        true;

    await loadAssignableUsers();
}


/* =====================================================
 * OUVRIR REVIEW
 * ===================================================== */

function openReview(
    decision:
        'VALIDATE'
        |
        'REJECT',
) {
    reviewDecision.value =
        decision;

    reviewForm.value = {
        relevance:
            item.value?.relevance
            ??
            0,

        comment:
            '',
    };

    reviewDialog.value =
        true;
}


/* =====================================================
 * ENREGISTRER REVIEW
 * ===================================================== */

async function submitReview() {
    try {
        await reviewWatchItem(
            itemId.value,
            {
                decision:
                    reviewDecision.value,

                relevance:
                    reviewForm.value.relevance
                    ??
                    undefined,

                comment:
                    reviewForm.value.comment
                    ||
                    undefined,
            },
        );

        reviewDialog.value =
            false;

        success.value =
            reviewDecision.value ===
                'VALIDATE'
                ? 'Élément validé.'
                : 'Élément rejeté.';


        actionSuccess(
            toast,

            reviewDecision.value ===
                'VALIDATE'
                ? 'Veille validée'
                : 'Veille rejetée',

            success.value,
        );


        await load();

    } catch (
    e:
        any
    ) {
        error.value =
            e.response
                ?.data
                ?.message
            ??
            'Décision impossible.';


        showActionError(
            toast,
            e,
            'Décision impossible',
            'La décision n’a pas pu être enregistrée.',
        );
    }
}


/* =====================================================
 * PUBLICATION
 * ===================================================== */

async function publish() {
    try {
        await publishWatchItem(
            itemId.value,
            'Publication validée.',
        );

        success.value =
            'Élément publié.';


        actionSuccess(
            toast,
            'Veille publiée',
            'L’élément de veille est maintenant publié.',
        );


        await load();

    } catch (
    e:
        any
    ) {
        error.value =
            e.response
                ?.data
                ?.message
            ??
            'Publication impossible.';


        showActionError(
            toast,
            e,
            'Publication impossible',
            'L’élément de veille n’a pas pu être publié.',
        );
    }
}


/* =====================================================
 * ARCHIVAGE
 * ===================================================== */

async function archive() {
    try {
        await archiveWatchItem(
            itemId.value,
            'Archivage.',
        );

        success.value =
            'Élément archivé.';


        actionSuccess(
            toast,
            'Veille archivée',
            'L’élément de veille a été archivé.',
        );


        await load();

    } catch (
    e:
        any
    ) {
        error.value =
            e.response
                ?.data
                ?.message
            ??
            'Archivage impossible.';


        showActionError(
            toast,
            e,
            'Archivage impossible',
            'L’élément de veille n’a pas pu être archivé.',
        );
    }
}


/* =====================================================
 * CRÉER ACTION
 * ===================================================== */

async function submitAction() {
    actionError.value =
        '';


    if (
        !actionForm.value.title.trim()
    ) {
        actionError.value =
            'Saisissez le titre de l’action.';

        toast.add({
            severity:
                'warn',

            summary:
                'Titre obligatoire',

            detail:
                actionError.value,

            life:
                4500,
        });

        return;
    }


    if (
        !actionForm.value.ownerId
    ) {
        actionError.value =
            'Choisissez un responsable.';

        toast.add({
            severity:
                'warn',

            summary:
                'Responsable obligatoire',

            detail:
                actionError.value,

            life:
                4500,
        });

        return;
    }


    actionSubmitting.value =
        true;


    try {
        await createAction(
            itemId.value,
            {
                title:
                    actionForm.value.title
                        .trim(),

                description:
                    actionForm.value.description
                    ||
                    undefined,

                actionType:
                    actionForm.value.actionType,

                impact:
                    actionForm.value.impact
                    ||
                    undefined,

                progressComment:
                    actionForm.value.progressComment || undefined,

                result:
                    actionForm.value.result || undefined,

                dueDate:
                    actionForm.value.dueDate
                    ||
                    undefined,

                ownerId:
                    actionForm.value.ownerId,
            },
        );


        actionDialog.value =
            false;


        actionForm.value = {
            title:
                '',

            description:
                '',

            actionType:
                'ANALYSE_IMPACT',

            impact:
                '',

            progressComment:
                '',

            result:
                '',

            dueDate:
                '',

            ownerId:
                null,
        };


        success.value =
            'Action créée.';


        actionSuccess(
            toast,
            'Action créée',
            'La nouvelle action de suivi a été enregistrée.',
        );


        await load();

    } catch (
    e:
        any
    ) {
        const message =
            e.response
                ?.data
                ?.message;


        actionError.value =
            Array.isArray(
                message,
            )
                ? message.join(
                    ' ',
                )
                : message
                ??
                'Création impossible.';


        showActionError(
            toast,
            e,
            'Création impossible',
            'L’action de suivi n’a pas pu être créée.',
        );

    } finally {
        actionSubmitting.value =
            false;
    }
}


/* =====================================================
 * MODIFIER ACTION
 * ===================================================== */

async function openEditAction(
    action:
        FollowUpAction,
) {
    if (
        !canManageAction(
            action,
        )
    ) {
        return;
    }


    editActionError.value =
        '';

    editingAction.value =
        action;


    editActionForm.value = {
        title:
            action.title,

        description:
            action.description
            ??
            '',

        actionType:
            action.actionType,

        impact:
            action.impact
            ??
            '',

        progressComment:
            action.progressComment
            ??
            '',

        result:
            action.result
            ??
            '',

        dueDate:
            action.dueDate
            ??
            '',

        ownerId:
            action.owner?.id
            ??
            null,
    };


    editActionDialog.value =
        true;


    if (
        !users.value.length
    ) {
        await loadAssignableUsers();
    }
}


async function submitActionEdit() {
    const action =
        editingAction.value;


    if (
        !action
        ||
        editActionSubmitting.value
    ) {
        return;
    }


    if (
        !editActionForm.value.title.trim()
    ) {
        editActionError.value =
            'Saisissez le titre de l’action.';

        return;
    }


    if (
        !editActionForm.value.ownerId
    ) {
        editActionError.value =
            'Choisissez un responsable.';

        return;
    }


    editActionSubmitting.value =
        true;

    editActionError.value =
        '';


    try {
        await updateAction(
            action.id,
            {
                title:
                    editActionForm.value.title
                        .trim(),

                description:
                    editActionForm.value.description,

                actionType:
                    editActionForm.value.actionType,

                impact:
                    editActionForm.value.impact,

                progressComment:
                    editActionForm.value.progressComment,

                result:
                    editActionForm.value.result,

                dueDate:
                    editActionForm.value.dueDate
                    ||
                    null,

                ownerId:
                    editActionForm.value.ownerId,
            },
        );


        editActionDialog.value =
            false;

        editingAction.value =
            null;


        actionSuccess(
            toast,
            'Action modifiée',
            'Les informations de l’action ont été mises à jour.',
        );


        await load();

    } catch (
    e:
        any
    ) {
        editActionError.value =
            e.response
                ?.data
                ?.message
            ??
            'Modification impossible.';


        showActionError(
            toast,
            e,
            'Modification impossible',
            'L’action de suivi n’a pas pu être modifiée.',
        );

    } finally {
        editActionSubmitting.value =
            false;
    }
}


/* =====================================================
 * SUPPRIMER ACTION
 * ===================================================== */

function askDeleteAction(
    action:
        FollowUpAction,
) {
    if (
        !canManageAction(
            action,
        )
    ) {
        return;
    }

    actionToDelete.value =
        action;

    deleteActionDialog.value =
        true;
}


async function confirmDeleteAction() {
    const action =
        actionToDelete.value;


    if (
        !action
        ||
        actionDeleting.value
    ) {
        return;
    }


    actionDeleting.value =
        true;


    try {
        await deleteAction(
            action.id,
        );


        deleteActionDialog.value =
            false;

        actionToDelete.value =
            null;


        actionSuccess(
            toast,
            'Action supprimée',
            `L’action « ${action.title} » a été supprimée.`,
        );


        await load();

    } catch (
    e:
        any
    ) {
        showActionError(
            toast,
            e,
            'Suppression impossible',
            'L’action de suivi n’a pas pu être supprimée.',
        );

    } finally {
        actionDeleting.value =
            false;
    }
}


/* =====================================================
 * CHANGER STATUT ACTION
 * ===================================================== */

async function changeActionStatus(
    action:
        FollowUpAction,

    status:
        string,
) {
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

            `Le statut de l’action « ${action.title} » a été mis à jour.`,
        );


        await load();

    } catch (
    e:
        any
    ) {
        error.value =
            e.response
                ?.data
                ?.message
            ??
            'Modification impossible.';


        showActionError(
            toast,
            e,
            'Modification impossible',
            'Le statut de l’action n’a pas pu être modifié.',
        );
    }
}


/* =====================================================
 * INIT
 * ===================================================== */

onMounted(
    load,
);
</script>


<template>
    <AppLayout>

        <div class="detail-page">

            <PageHeader title="Détail de la veille"
                subtitle="Consultation, validation et suivi de l’élément sélectionné." eyebrow="Veille"
                icon="pi pi-file">
                <template #actions>

                    <Button label="Retour" severity="secondary" @click="returnToWatchItems">
                        <template #icon>
                            <ArrowLeftIcon size="0.9rem" />
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


            <Message v-if="
                success
            " severity="success" closable @close="
                success = ''
                ">
                {{ success }}
            </Message>


            <AppSpinner v-if="
                loading
            " size="large" centered label="Chargement de la veille…" />


            <template v-else-if="
                item
            ">

                <SectionCard>

                    <article class="watch-hero">

                        <div class="watch-main">

                            <div class="watch-heading-row">

                                <div class="source-icon">
                                    <i class="pi pi-book" />
                                </div>


                                <div class="watch-heading-copy">

                                    <span class="watch-source">
                                        {{
                                            item.source?.name
                                            ??
                                            'Source non renseignée'
                                        }}
                                    </span>

                                    <h2>
                                        <span v-html="displayedTitleHtml" />
                                    </h2>

                                    <div v-if="availableDisplayLanguages.length" class="language-switch" aria-label="Langue du contenu">
                                        <Button
                                            v-for="language in availableDisplayLanguages"
                                            :key="language"
                                            :label="language === 'fr' ? 'Français' : language === 'en' ? 'Anglais' : `Original (${itemOriginalLanguage.toUpperCase()})`"
                                            size="small"
                                            :severity="displayLanguage === language ? 'primary' : 'secondary'"
                                            :outlined="displayLanguage !== language"
                                            :loading="language === 'en' && translatingToEnglish"
                                            :disabled="translatingToEnglish"
                                            @click="selectDisplayLanguage(language)"
                                        />
                                    </div>

                                </div>

                            </div>


                            <p class="watch-summary" :class="{ 'watch-summary-expanded': summaryExpanded }">
                                {{
                                    displayedSummary
                                    ||
                                    'Aucun résumé disponible.'
                                }}
                            </p>

                            <div class="summary-actions">
                                <button
                                    v-if="summaryCanExpand"
                                    type="button"
                                    class="summary-toggle"
                                    :aria-expanded="summaryExpanded"
                                    @click="summaryExpanded = !summaryExpanded"
                                >
                                    {{ summaryExpanded ? 'Voir moins' : 'Voir plus' }}
                                </button>

                                <a
                                    v-if="safeExternalUrl(item.url)"
                                    :href="safeExternalUrl(item.url) ?? undefined"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="original-link"
                                >
                                    <i class="pi pi-external-link" aria-hidden="true" />
                                    Consulter la source originale
                                </a>
                            </div>

                        </div>


                        <aside class="watch-meta">

                            <div class="meta-line">
                                <span>
                                    Statut
                                </span>

                                <StatusBadge :status="item.status
                                    " />
                            </div>


                            <div class="meta-line">
                                <span>
                                    Priorité
                                </span>

                                <strong :style="{
                                    color:
                                        currentPriorityColor,
                                }">
                                    {{
                                        item.relevance
                                        ??
                                        '—'
                                    }}
                                    <small v-if="
                                        item.relevance !==
                                        null
                                        &&
                                        item.relevance !==
                                        undefined
                                    ">
                                        / 100
                                    </small>
                                </strong>
                            </div>


                            <div class="meta-line">
                                <span>
                                    Importance
                                </span>

                                <strong :style="{
                                    color:
                                        currentPriorityColor,
                                }">
                                    {{ currentPriorityLabel }}
                                </strong>
                            </div>


                            <div class="meta-line">
                                <span>
                                    Type de veille
                                </span>

                                <strong>
                                    {{
                                        labelFr(
                                            item.watchType,
                                        )
                                    }}
                                </strong>
                            </div>


                            <div class="meta-line">
                                <span>
                                    Publication
                                </span>

                                <strong>
                                    {{
                                        formatDate(
                                            item.publishedAt,
                                        )
                                    }}
                                </strong>
                            </div>

                        </aside>

                    </article>

                </SectionCard>

                <SectionCard v-if="
                    canValidate
                " title="Décision" subtitle="Validation et diffusion de l’élément de veille."
                    icon="pi pi-check-circle">

                    <div class="decision-zone">

                        <template v-if="
                            item.status ===
                            'A_QUALIFIER'
                        ">

                            <Button label="Valider" severity="success" icon="pi pi-check" @click="
                                openReview(
                                    'VALIDATE',
                                )
                                " />

                            <Button label="Rejeter" severity="danger" icon="pi pi-times" @click="
                                openReview(
                                    'REJECT',
                                )
                                " />

                        </template>


                        <Button v-if="
                            item.status ===
                            'VALIDE'
                        " label="Publier" icon="pi pi-send" @click="
                            publish
                        " />


                        <Button v-if="
                            item.status ===
                            'PUBLIE'
                        " label="Archiver" severity="secondary" icon="pi pi-box" @click="
                            archive
                        " />


                        <span v-if="
                            ![
                                'A_QUALIFIER',
                                'VALIDE',
                                'PUBLIE',
                            ].includes(
                                item.status,
                            )
                        " class="decision-info">
                            Aucune décision supplémentaire
                            n’est disponible pour ce statut.
                        </span>

                    </div>

                </SectionCard>


                <SectionCard v-if="
                    canViewReviews
                " title="Historique des décisions" :subtitle="`${reviews.length} décision${reviews.length > 1 ? 's' : ''} enregistrée${reviews.length > 1 ? 's' : ''}`
                    " icon="pi pi-history">

                    <div class="section-toolbar">

                        <div class="search-box">

                            <SearchIcon size="0.8rem" />

                            <InputText v-model="reviewSearch
                                " class="w-full" placeholder="Rechercher dans l’historique..." />

                        </div>

                    </div>


                    <DataTable :value="filteredReviews
                        " paginator :rows="10
                            ">

                        <template #empty>
                            Aucune décision ne correspond à la recherche.
                        </template>


                        <Column header="Décision" style="width: 9rem">
                            <template #body="{ data }">
                                <StatusBadge :status="data.status
                                    " />
                            </template>
                        </Column>


                        <Column header="Importance" style="width: 9rem">
                            <template #body="{ data }">

                                <Tag :value="data.criticality
                                    ? labelFr(
                                        data.criticality,
                                    )
                                    : 'Non définie'
                                    " />

                            </template>
                        </Column>


                        <Column field="relevance" header="Priorité" style="width: 7rem">
                            <template #body="{ data }">
                                <strong class="priority-value">
                                    {{
                                        data.relevance
                                        ??
                                        '—'
                                    }}
                                </strong>
                            </template>
                        </Column>


                        <Column field="comment" header="Commentaire" style="min-width: 14rem">
                            <template #body="{ data }">
                                <span class="table-text">
                                    {{
                                        data.comment
                                        ||
                                        'Aucun commentaire'
                                    }}
                                </span>
                            </template>
                        </Column>


                        <Column header="Auteur" style="min-width: 11rem">
                            <template #body="{ data }">

                                <div class="reviewer-cell">

                                    <div class="mini-avatar">
                                        {{
                                            (
                                                `${data.reviewer?.firstName?.[0] ?? ''}${data.reviewer?.lastName?.[0] ?? ''}`
                                            ).toUpperCase()
                                            ||
                                            'U'
                                        }}
                                    </div>

                                    <span>
                                        {{
                                            `${data.reviewer?.firstName ?? ''} ${data.reviewer?.lastName ?? ''}`
                                                .trim()
                                            ||
                                            data.reviewer?.email
                                            ||
                                            'Non renseigné'
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
                                            data.reviewedAt,
                                        )
                                    }}
                                </span>
                            </template>
                        </Column>

                    </DataTable>

                </SectionCard>


                <SectionCard v-if="
                    canCreateAction
                " title="Actions de suivi" :subtitle="`${actions.length} action${actions.length > 1 ? 's' : ''} liée${actions.length > 1 ? 's' : ''} à cette veille`
                    " icon="pi pi-check-square">

                    <div class="actions-toolbar">

                        <div class="search-box">

                            <SearchIcon size="0.8rem" />

                            <InputText v-model="actionSearch
                                " class="w-full" placeholder="Rechercher une action..." />

                        </div>


                        <Button v-if="
                            canCreateActionForCurrentStatus
                        " label="Créer une action" @click="
                            openActionDialog
                        ">
                            <template #icon>
                                <PlusIcon size="0.9rem" />
                            </template>
                        </Button>

                    </div>


                    <Message :severity="canCreateActionForCurrentStatus
                        ? 'info'
                        : 'warn'
                        " :closable="false
                            ">
                        {{ actionCreationHelp }}
                    </Message>


                    <DataTable :value="filteredActions
                        ">

                        <template #empty>
                            Aucune action ne correspond à la recherche.
                        </template>


                        <Column field="title" header="Action" style="min-width: 13rem">
                            <template #body="{ data }">

                                <div class="action-title-cell">

                                    <strong>
                                        {{ data.title }}
                                    </strong>

                                    <span v-if="
                                        data.description
                                    ">
                                        {{ data.description }}
                                    </span>

                                </div>

                            </template>
                        </Column>


                        <Column header="Type" style="width: 11rem">
                            <template #body="{ data }">
                                {{
                                    labelFr(
                                        data.actionType,
                                    )
                                }}
                            </template>
                        </Column>


                        <Column header="Responsable" style="min-width: 11rem">
                            <template #body="{ data }">
                                {{
                                    actionOwnerName(
                                        data,
                                    )
                                }}
                            </template>
                        </Column>


                        <Column header="Échéance" style="width: 9rem">
                            <template #body="{ data }">
                                <span class="date-text">
                                    {{
                                        formatDate(
                                            data.dueDate,
                                            false,
                                        )
                                    }}
                                </span>
                            </template>
                        </Column>


                        <Column header="Statut" style="width: 8rem">
                            <template #body="{ data }">

                                <Tag :value="labelFr(
                                    data.status,
                                )
                                    " :severity="actionStatusSeverity(
                                        data.status,
                                    )
                                        " />

                            </template>
                        </Column>


                        <Column header="Actions" style="min-width: 12rem">
                            <template #body="{ data }">

                                <div class="row-actions">

                                    <Button v-if="
                                        data.status ===
                                        'OPEN'
                                        &&
                                        canManageAction(
                                            data,
                                        )
                                    " label="Démarrer" size="small" @click="
                                        changeActionStatus(
                                            data,
                                            'IN_PROGRESS',
                                        )
                                        " />


                                    <Button v-if="
                                        data.status ===
                                        'IN_PROGRESS'
                                        &&
                                        canManageAction(
                                            data,
                                        )
                                    " label="Terminer" size="small" severity="success" @click="
                                        changeActionStatus(
                                            data,
                                            'DONE',
                                        )
                                        " />


                                    <Button v-if="
                                        canManageAction(
                                            data,
                                        )
                                    " severity="secondary" rounded size="small" title="Modifier l’action"
                                        aria-label="Modifier l’action" @click="
                                            openEditAction(
                                                data,
                                            )
                                            ">
                                        <template #icon>
                                            <PencilIcon size="0.8rem" />
                                        </template>
                                    </Button>


                                    <Button v-if="
                                        canManageAction(
                                            data,
                                        )
                                    " severity="danger" text rounded size="small" title="Supprimer l’action"
                                        aria-label="Supprimer l’action" @click="
                                            askDeleteAction(
                                                data,
                                            )
                                            ">
                                        <template #icon>
                                            <TrashIcon size="0.8rem" />
                                        </template>
                                    </Button>

                                </div>

                            </template>
                        </Column>

                    </DataTable>

                </SectionCard>

            </template>



            <Dialog v-model:visible="reviewDialog
                " modal :header="reviewDecision ===
                    'VALIDATE'
                    ? 'Valider la veille'
                    : 'Rejeter la veille'
                    " class="w-full max-w-xl">

                <form class="space-y-5" @submit.prevent="
                    submitReview
                ">

                    <div class="review-priority">

                        <div class="priority-header">

                            <div>
                                <strong>
                                    Priorité globale
                                </strong>

                                <span>
                                    Le niveau d’importance sera calculé automatiquement.
                                </span>
                            </div>


                            <strong class="priority-score" :style="{
                                color:
                                    reviewPriorityColor,
                            }">
                                {{ reviewPriorityScore }}
                                <small>
                                    / 100
                                </small>
                            </strong>

                        </div>


                        <Slider v-model="reviewPriorityScore
                            " :min="0
                                " :max="100
                    " :step="1
                    " class="w-full" />


                        <div class="priority-scale">
                            <span>
                                0
                            </span>

                            <span>
                                25
                            </span>

                            <span>
                                50
                            </span>

                            <span>
                                75
                            </span>

                            <span>
                                100
                            </span>
                        </div>


                        <div class="priority-level" :style="{
                            color:
                                reviewPriorityColor,
                        }">
                            <span>
                                Niveau
                            </span>

                            <strong>
                                {{ reviewPriorityLabel }}
                            </strong>
                        </div>

                    </div>


                    <div>

                        <label class="mb-2 block" :class="{
                            'required-label':
                                reviewDecision ===
                                'REJECT',
                        }">
                            Commentaire
                        </label>

                        <Textarea v-model="reviewForm.comment
                            " rows="5" class="w-full" placeholder="Ajouter un commentaire..." :required="reviewDecision ===
                                'REJECT'
                                " />

                    </div>


                    <div class="dialog-actions">

                        <Button type="button" label="Annuler" severity="secondary" @click="
                            reviewDialog =
                            false
                            " />

                        <Button type="submit" :label="reviewDecision ===
                            'VALIDATE'
                            ? 'Valider'
                            : 'Rejeter'
                            " :severity="reviewDecision ===
                                'VALIDATE'
                                ? 'success'
                                : 'danger'
                                " />

                    </div>

                </form>

            </Dialog>

            <Dialog v-model:visible="actionDialog
                " modal header="Nouvelle action" class="w-full max-w-2xl">

                <form class="space-y-4" @submit.prevent="
                    submitAction
                ">

                    <Message v-if="
                        actionError
                    " severity="error" closable @close="
                        actionError = ''
                        ">
                        {{ actionError }}
                    </Message>


                    <div>

                        <label class="required-label mb-2 block">
                            Titre
                        </label>

                        <InputText v-model="actionForm.title
                            " class="w-full" placeholder="Exemple : Vérifier l’impact sur la méthode" required />

                    </div>


                    <div>

                        <label class="mb-2 block">
                            Description
                        </label>

                        <Textarea v-model="actionForm.description
                            " rows="4" class="w-full" />

                    </div>

                    <div>
                        <label class="mb-2 block">Commentaire d’avancement</label>
                        <Textarea v-model="actionForm.progressComment" rows="3" class="w-full" placeholder="Informations sur le suivi prévu..." />
                    </div>

                    <div>
                        <label class="mb-2 block">Résultat ou conclusion</label>
                        <Textarea v-model="actionForm.result" rows="3" class="w-full" placeholder="À compléter à la fin de l’action..." />
                    </div>


                    <div class="grid gap-4 md:grid-cols-2">

                        <div>

                            <label class="required-label mb-2 block">
                                Type
                            </label>

                            <div class="select-host">
                                <Select append-to="self" v-model="actionForm.actionType
                                    " :options="optionsFr(
                                    actionTypes,
                                )
                                    " option-label="label" option-value="value" class="w-full" />
                            </div>

                        </div>


                        <div>

                            <label class="required-label mb-2 block">
                                Responsable
                            </label>

                            <div class="select-host">
                                <Select append-to="self" v-model="actionForm.ownerId
                                    " :options="userOptions
                                    " option-label="label" option-value="id" filter :loading="usersLoading
                        " placeholder="Choisir un responsable" class="w-full" />
                            </div>

                        </div>

                    </div>


                    <Message v-if="
                        !usersLoading
                        &&
                        !userOptions.length
                    " severity="warn">
                        Aucun utilisateur actif ne peut être désigné comme responsable.
                    </Message>


                    <div>

                        <label class="mb-2 block">
                            Impact
                        </label>

                        <Textarea v-model="actionForm.impact
                            " rows="3" class="w-full" />

                    </div>


                    <div>

                        <label class="mb-2 block">
                            Échéance
                        </label>

                        <InputText v-model="actionForm.dueDate
                            " type="date" class="w-full" />

                    </div>


                    <div class="dialog-actions">

                        <Button type="button" label="Annuler" severity="secondary" @click="
                            actionDialog =
                            false
                            " />

                        <Button type="submit" label="Créer l'action" :loading="actionSubmitting
                            " :disabled="usersLoading
                                ||
                                !userOptions.length
                                " />

                    </div>

                </form>

            </Dialog>


            <Dialog v-model:visible="editActionDialog
                " modal header="Modifier l’action" class="w-full max-w-2xl" :closable="!editActionSubmitting
                    " :close-on-escape="!editActionSubmitting
                ">

                <form class="space-y-4" @submit.prevent="
                    submitActionEdit
                ">

                    <Message v-if="
                        editActionError
                    " severity="error">
                        {{ editActionError }}
                    </Message>


                    <div>

                        <label class="required-label mb-2 block">
                            Titre
                        </label>

                        <InputText v-model="editActionForm.title
                            " class="w-full" required :disabled="editActionSubmitting
                                " />

                    </div>


                    <div>

                        <label class="mb-2 block">
                            Description
                        </label>

                        <Textarea v-model="editActionForm.description
                            " rows="4" class="w-full" :disabled="editActionSubmitting
                                " />

                    </div>

                    <div>
                        <label class="mb-2 block">Commentaire d’avancement</label>
                        <Textarea v-model="editActionForm.progressComment" rows="3" class="w-full" :disabled="editActionSubmitting" />
                    </div>

                    <div>
                        <label class="mb-2 block">Résultat ou conclusion</label>
                        <Textarea v-model="editActionForm.result" rows="3" class="w-full" :disabled="editActionSubmitting" />
                    </div>


                    <div class="grid gap-4 md:grid-cols-2">

                        <div>

                            <label class="required-label mb-2 block">
                                Type
                            </label>

                            <div class="select-host">
                                <Select append-to="self" v-model="editActionForm.actionType
                                    " :options="optionsFr(
                                    actionTypes,
                                )
                                    " option-label="label" option-value="value" class="w-full" :disabled="editActionSubmitting
                        " />
                            </div>

                        </div>


                        <div>

                            <label class="required-label mb-2 block">
                                Responsable
                            </label>

                            <div class="select-host">
                                <Select append-to="self" v-model="editActionForm.ownerId
                                    " :options="userOptions
                                    " option-label="label" option-value="id" filter class="w-full" :loading="usersLoading
                        " :disabled="editActionSubmitting
                        ||
                        (
                            !roles.includes(
                                'ADMIN',
                            )
                            &&
                            !roles.includes(
                                'RESPONSABLE_VEILLE',
                            )
                        )
                        " />
                            </div>

                        </div>

                    </div>


                    <div>

                        <label class="mb-2 block">
                            Impact
                        </label>

                        <Textarea v-model="editActionForm.impact
                            " rows="3" class="w-full" :disabled="editActionSubmitting
                                " />

                    </div>


                    <div>

                        <label class="mb-2 block">
                            Échéance
                        </label>

                        <InputText v-model="editActionForm.dueDate
                            " type="date" class="w-full" :disabled="editActionSubmitting
                                " />

                    </div>


                    <div class="dialog-actions">

                        <Button type="button" label="Annuler" severity="secondary" :disabled="editActionSubmitting
                            " @click="
                                editActionDialog =
                                false
                                " />

                        <Button type="submit" label="Enregistrer les modifications" :loading="editActionSubmitting
                            " />

                    </div>

                </form>

            </Dialog>

            <Dialog v-model:visible="deleteActionDialog
                " modal header="Confirmer la suppression" class="w-full max-w-md" :closable="!actionDeleting
                    " :close-on-escape="!actionDeleting
                ">

                <div class="space-y-5">

                    <p v-if="
                        actionToDelete
                    ">
                        Êtes-vous sûr de vouloir supprimer l’action
                        <strong>
                            « {{ actionToDelete.title }} »
                        </strong>
                        ?
                    </p>


                    <Message severity="warn" :closable="false
                        ">
                        Cette suppression est définitive.
                    </Message>


                    <div class="dialog-actions">

                        <Button label="Annuler" severity="secondary" :disabled="actionDeleting
                            " @click="
                                deleteActionDialog =
                                false
                                " />

                        <Button label="Supprimer" severity="danger" :loading="actionDeleting
                            " @click="
                                confirmDeleteAction
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
/* =====================================================
 * PAGE
 * ===================================================== */

.detail-page {
    display:
        grid;

    width:
        min(100%,
            78rem);

    margin:
        0 auto;

    gap:
        1rem;
}


/* =====================================================
 * HERO
 * ===================================================== */

.watch-hero {
    display:
        grid;

    grid-template-columns:
        minmax(0,
            1fr) 16rem;

    gap:
        1.5rem;
}


.watch-main {
    min-width:
        0;
}


.watch-heading-row {
    display:
        flex;

    align-items:
        flex-start;

    gap:
        0.8rem;
}


.source-icon {
    display:
        grid;

    width:
        2.7rem;

    height:
        2.7rem;

    flex:
        0 0 2.7rem;

    place-items:
        center;

    border-radius:
        0.8rem;

    background:
        rgb(16 185 129 / 0.12);

    color:
        var(--app-primary);
}


.watch-heading-copy {
    min-width:
        0;
}


.watch-source {
    color:
        var(--app-primary);

    font-size:
        0.66rem;

    font-weight:
        750;

    letter-spacing:
        0.04em;

    text-transform:
        uppercase;
}


.watch-heading-copy h2 {
    margin:
        0.25rem 0 0;

    color:
        var(--app-text);

    font-size:
        clamp(1.25rem,
            2.4vw,
            1.8rem);

    font-weight:
        780;

    line-height:
        1.25;

    overflow-wrap:
        anywhere;
}

.language-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.75rem;
}


.watch-summary {
    margin:
        1rem 0 0;

    color:
        var(--app-text-secondary);

    font-size:
        0.8rem;

    line-height:
        1.7;

    white-space:
        pre-line;

    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
}

.watch-summary-expanded {
    display: block;
    overflow: visible;
    -webkit-line-clamp: unset;
}

.summary-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.65rem;
}

.summary-toggle,
.original-link {
    display: inline-flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--app-border-strong);
    border-radius: 0.65rem;
    background: var(--app-surface-2);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none;
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.summary-toggle {
    color: var(--app-primary);
    cursor: pointer;
}

.summary-toggle:hover {
    border-color: color-mix(in srgb, var(--app-primary) 45%, var(--app-border-strong));
    background: color-mix(in srgb, var(--app-primary) 10%, var(--app-surface-2));
}

.original-link {
    color: var(--app-blue);
}

.original-link:hover {
    border-color: color-mix(in srgb, var(--app-blue) 45%, var(--app-border-strong));
    background: color-mix(in srgb, var(--app-blue) 10%, var(--app-surface-2));
    color: #93c5fd;
}

.summary-toggle:focus-visible,
.original-link:focus-visible {
    outline: 2px solid var(--app-primary);
    outline-offset: 2px;
}


/* =====================================================
 * META
 * ===================================================== */

.watch-meta {
    display:
        grid;

    align-content:
        start;

    gap:
        0;

    overflow:
        hidden;

    border-radius:
        0.8rem;

    background:
        var(--app-surface-2);
}


.meta-line {
    display:
        flex;

    min-height:
        3.2rem;

    align-items:
        center;

    justify-content:
        space-between;

    gap:
        0.6rem;

    padding:
        0.65rem 0.8rem;

    border-bottom:
        1px solid var(--app-border);
}


.meta-line:last-child {
    border-bottom:
        0;
}


.meta-line>span {
    color:
        var(--app-text-muted);

    font-size:
        0.63rem;

    font-weight:
        700;

    text-transform:
        uppercase;
}


.meta-line strong {
    color:
        var(--app-text-secondary);

    font-size:
        0.71rem;

    text-align:
        right;
}


.meta-line strong>small {
    color:
        var(--app-text-muted);

    font-size:
        0.6rem;
}


/* =====================================================
 * DÉCISION
 * ===================================================== */

.decision-zone {
    display:
        flex;

    flex-wrap:
        wrap;

    align-items:
        center;

    gap:
        0.6rem;
}


.decision-info {
    color:
        var(--app-text-muted);

    font-size:
        0.72rem;
}


/* =====================================================
 * TOOLBARS
 * ===================================================== */

.section-toolbar,
.actions-toolbar {
    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    gap:
        0.8rem;

    margin-bottom:
        0.8rem;
}


.search-box {
    position:
        relative;

    width:
        min(100%,
            25rem);
}


.search-box>svg {
    position:
        absolute;

    top:
        50%;

    left:
        0.8rem;

    z-index:
        2;

    transform:
        translateY(-50%);

    color:
        var(--app-text-muted);
}


.search-box :deep(input) {
    padding-left:
        2.25rem;
}


/* =====================================================
 * HISTORIQUE
 * ===================================================== */

.priority-value {
    color:
        var(--app-primary);

    font-size:
        0.78rem;
}


.table-text,
.date-text {
    color:
        var(--app-text-muted);

    font-size:
        0.7rem;
}


.reviewer-cell {
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
        0.58rem;

    font-weight:
        800;
}


.reviewer-cell span {
    min-width:
        0;

    overflow:
        hidden;

    color:
        var(--app-text-secondary);

    font-size:
        0.7rem;

    text-overflow:
        ellipsis;

    white-space:
        nowrap;
}


/* =====================================================
 * ACTIONS
 * ===================================================== */

.action-title-cell {
    display:
        grid;

    gap:
        0.15rem;
}


.action-title-cell strong {
    color:
        var(--app-text);

    font-size:
        0.74rem;
}


.action-title-cell span {
    display:
        -webkit-box;

    overflow:
        hidden;

    color:
        var(--app-text-muted);

    font-size:
        0.66rem;

    line-height:
        1.4;

    -webkit-box-orient:
        vertical;

    -webkit-line-clamp:
        2;
}


.row-actions {
    display:
        flex;

    flex-wrap:
        nowrap;

    align-items:
        center;

    gap:
        0.35rem;
}


/* =====================================================
 * REVIEW DIALOG
 * ===================================================== */

.review-priority {
    display:
        grid;

    gap:
        1rem;

    padding:
        1rem;

    border-radius:
        0.8rem;

    background:
        var(--app-surface-2);
}


.priority-header {
    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    gap:
        1rem;
}


.priority-header>div {
    display:
        grid;

    gap:
        0.15rem;
}


.priority-header>div strong {
    color:
        var(--app-text);

    font-size:
        0.8rem;
}


.priority-header>div span {
    color:
        var(--app-text-muted);

    font-size:
        0.65rem;
}


.priority-score {
    flex:
        none;

    font-size:
        1.4rem;
}


.priority-score small {
    font-size:
        0.7rem;

    font-weight:
        600;
}


.priority-scale {
    display:
        flex;

    justify-content:
        space-between;

    color:
        var(--app-text-muted);

    font-size:
        0.6rem;
}


.priority-level {
    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    padding:
        0.6rem 0.7rem;

    border-radius:
        0.65rem;

    background:
        var(--app-surface);
}


.priority-level span {
    color:
        var(--app-text-muted);

    font-size:
        0.65rem;
}


.priority-level strong {
    font-size:
        0.78rem;
}


/* =====================================================
 * DIALOG
 * ===================================================== */

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


/* =====================================================
 * RESPONSIVE
 * ===================================================== */

@media (max-width: 900px) {

    .watch-hero {
        grid-template-columns:
            1fr;
    }


    .watch-meta {
        grid-template-columns:
            repeat(2,
                minmax(0,
                    1fr));
    }


    .meta-line {
        border-right:
            1px solid var(--app-border);
    }


    .section-toolbar,
    .actions-toolbar {
        align-items:
            stretch;

        flex-direction:
            column;
    }


    .search-box {
        width:
            100%;
    }

}


@media (max-width: 560px) {

    .watch-meta {
        grid-template-columns:
            1fr;
    }


    .meta-line {
        border-right:
            0;
    }


    .priority-header {
        align-items:
            flex-start;

        flex-direction:
            column;
    }


    .dialog-actions {
        flex-direction:
            column-reverse;
    }


    .dialog-actions :deep(.p-button) {
        width:
            100%;
    }

}
</style>
