<script setup lang="ts">
import {
    computed,
    onMounted,
    ref,
    nextTick,
} from 'vue';

import {
    useRoute,
    useRouter,
} from 'vue-router';

import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Message from 'primevue/message';
import MultiSelect from 'primevue/multiselect';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';

import {
    useToast,
} from 'primevue/usetoast';

import ArrowLeftIcon from '@primeicons/vue/arrow-left';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';
import { safeExternalUrl } from '../utils/safe-external-url';
import { useAuthStore } from '../stores/auth';

import {
    labelFr,
    optionsFr,
} from '../i18n/labels';

import {
    getPriorityColor,
    getPriorityLabel,
} from '../utils/priority';

import {
    getWatchItem,
    type WatchItem,
} from '../services/watch-items.service';

import {
    getDomains,
    getKeywords,
    getLaboratories,
    getTopics,
    type Domain,
    type Keyword,
    type Laboratory,
    type Topic,
} from '../services/taxonomy.service';

import {
    qualifyWatchItem,
    getQualification,
} from '../services/qualification.service';

import {
    actionError,
    actionSuccess,
} from '../utils/action-toast';

import {
    clampInteger,
} from '../utils/numeric-input';
import {
    getAiAnalysis,
    requestAiAnalysis,
    reviewAiAnalysis,
    type AiAnalysis,
    type AiAnalysisState,
} from '../services/ai-analysis.service';
import { reviewWatchItem } from '../services/validation.service';


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

const toast =
    useToast();
const authStore = useAuthStore();
const canRejectFromQualification = computed(() => authStore.user?.roles.some((role) => ['ADMIN', 'RESPONSABLE_VEILLE'].includes(role)) ?? false);

const item =
    ref<WatchItem | null>(
        null,
    );

const topics =
    ref<Topic[]>([]);

const keywords =
    ref<Keyword[]>([]);

const domains =
    ref<Domain[]>([]);

const laboratories =
    ref<Laboratory[]>([]);

const loading =
    ref(false);

const saving =
    ref(false);

const error =
    ref('');

const success =
    ref('');

const aiState = ref<AiAnalysisState>({ enabled: false, autoAnalysisEnabled: false, latest: null, history: [] });
const aiLoading = ref(false);
const aiSaving = ref(false);
const aiError = ref('');
const aiNotice = ref('');
const aiClassificationReported = ref(false);
const aiDraft = ref({ relevanceScore: 0, relevanceReason: '', summary: '', potentialImpacts: '', recommendedChecks: '', classificationWatchType: '' as string | null, classificationRationale: '', classificationThemes: '', classificationDomains: '', classificationKeywords: '', classificationKeywordWeights: [] as number[], classificationLaboratories: '' });
const aiDetailsExpanded = ref(false);
const rejectDialogVisible = ref(false);
const qualificationFormRef = ref<HTMLFormElement | null>(null);
const pendingTaxonomyLabels = ref<string[]>([]);

function prepareAiDraft(analysis: AiAnalysis) {
    aiDraft.value = {
        relevanceScore: analysis.relevanceScore,
        relevanceReason: analysis.relevanceReason,
        summary: analysis.summary ?? '',
        potentialImpacts: analysis.potentialImpacts.join('\n'),
        recommendedChecks: analysis.recommendedChecks.join('\n'),
        classificationWatchType: analysis.classification?.watchType ?? null,
        classificationRationale: analysis.classification?.rationale ?? '',
        classificationThemes: analysis.classification?.themes?.join('\n') ?? '',
        classificationDomains: analysis.classification?.domains?.join('\n') ?? '',
        classificationKeywords: analysis.classification?.keywords?.join('\n') ?? '',
        classificationKeywordWeights: analysis.classification?.keywordWeights ?? [],
        classificationLaboratories: analysis.classification?.laboratories?.join('\n') ?? '',
    };
}

function normalizeTaxonomyLabel(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR');
}

function matchingTaxonomyIds(suggestions: string, options: Array<{ id: number; label?: string; name?: string }>) {
    const labels = suggestions.split('\n').map(normalizeTaxonomyLabel).filter(Boolean);
    return [...new Set(options.filter((option) => labels.includes(normalizeTaxonomyLabel(option.label ?? option.name ?? ''))).map((option) => option.id))];
}

function addTemporaryTaxonomyOptions<T extends { id: number; label?: string; name?: string }>(
    target: T[],
    labels: string[],
    getLabel: (entry: T) => string,
    create: (label: string, id: number) => T,
) {
    let nextId = -1;
    for (const raw of labels) {
        const label = raw.trim();
        if (!label || target.some((entry) => normalizeTaxonomyLabel(getLabel(entry)) === normalizeTaxonomyLabel(label))) continue;
        while (target.some((entry) => entry.id === nextId)) nextId -= 1;
        target.push(create(label, nextId));
        nextId -= 1;
    }
}

function applyAiClassification() {
    if (!aiState.value.latest) return;
    if (aiDraft.value.classificationWatchType) form.value.watchType = aiDraft.value.classificationWatchType;
    addTemporaryTaxonomyOptions(topics.value, aiDraft.value.classificationThemes.split('\n'), (entry) => entry.label, (label, id) => ({ id, label, description: null, parent: null } as Topic));
    addTemporaryTaxonomyOptions(domains.value, aiDraft.value.classificationDomains.split('\n'), (entry) => entry.name, (label, id) => ({ id, name: label, description: null, active: true } as Domain));
    addTemporaryTaxonomyOptions(keywords.value, aiDraft.value.classificationKeywords.split('\n'), (entry) => entry.label, (label, id) => ({ id, label, weight: 5, active: true } as Keyword));
    addTemporaryTaxonomyOptions(laboratories.value, aiDraft.value.classificationLaboratories.split('\n'), (entry) => entry.name, (label, id) => ({ id, name: label, description: null, active: true } as Laboratory));
    form.value.topicIds = matchingTaxonomyIds(aiDraft.value.classificationThemes, topics.value);
    form.value.domainIds = matchingTaxonomyIds(aiDraft.value.classificationDomains, domains.value);
    form.value.keywordIds = matchingTaxonomyIds(aiDraft.value.classificationKeywords, keywords.value);
    form.value.laboratoryIds = matchingTaxonomyIds(aiDraft.value.classificationLaboratories, laboratories.value);
    form.value.relevance = clampInteger(aiDraft.value.relevanceScore, 0, 100);
    aiClassificationReported.value = true;
    pendingTaxonomyLabels.value = [
        ...aiDraft.value.classificationThemes.split('\n'),
        ...aiDraft.value.classificationDomains.split('\n'),
        ...aiDraft.value.classificationKeywords.split('\n'),
        ...aiDraft.value.classificationLaboratories.split('\n'),
    ].map((value) => value.trim()).filter(Boolean);
    const unmapped = aiDraft.value.classificationThemes.split('\n').filter(Boolean).length
        + aiDraft.value.classificationDomains.split('\n').filter(Boolean).length
        + aiDraft.value.classificationKeywords.split('\n').filter(Boolean).length
        + aiDraft.value.classificationLaboratories.split('\n').filter(Boolean).length;
    aiNotice.value = `Classification reportée. Les nouveaux termes seront créés avec leur poids de mot-clé IA lors de l’enregistrement${unmapped ? ` (${unmapped} libellé(s) proposé(s))` : ''}.`;
    void nextTick(() => qualificationFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

async function rejectAiSuggestion() {
    const latest = aiState.value.latest;
    if (!latest || aiSaving.value || !canRejectFromQualification.value) return;
    rejectDialogVisible.value = true;
}

async function confirmRejectAiSuggestion() {
    const latest = aiState.value.latest;
    if (!latest || aiSaving.value || !canRejectFromQualification.value) return;
    rejectDialogVisible.value = false;
    aiSaving.value = true;
    aiError.value = '';
    try {
        await reviewWatchItem(itemId.value, {
            decision: 'REJECT',
            relevance: clampInteger(aiDraft.value.relevanceScore, 0, 100) ?? 0,
            comment: `Rejetée après examen humain de la proposition IA (score proposé : ${clampInteger(aiDraft.value.relevanceScore, 0, 100) ?? 0}/100).`,
        });
        actionSuccess(toast, 'Veille rejetée', 'La veille et le motif sont enregistrés dans le suivi et le journal d’audit.');
        returnToWatchItems();
    } catch (err: any) {
        aiError.value = err.response?.data?.message ?? 'La veille n’a pas pu être rejetée.';
    } finally {
        aiSaving.value = false;
    }
}

async function refreshAiAnalysis() {
    aiError.value = '';
    try {
        const response = await getAiAnalysis(itemId.value);
        aiState.value = response.data;
        if (response.data.latest) {
            prepareAiDraft(response.data.latest);
            aiNotice.value = 'Une proposition IA précédente a été chargée. Vous pouvez la récupérer dans la qualification.';
        }
    } catch (err: any) {
        aiError.value = err.response?.data?.message ?? 'Impossible de charger les propositions IA.';
    }
}

async function runAiAnalysis() {
    if (aiLoading.value || !aiState.value.enabled) return;
    aiLoading.value = true;
    aiError.value = '';
    aiNotice.value = '';
    try {
        const response = await requestAiAnalysis(itemId.value, Boolean(aiState.value.latest));
        aiState.value.latest = response.data;
        aiState.value.history = [response.data, ...aiState.value.history.filter((entry) => entry.id !== response.data.id)];
        prepareAiDraft(response.data);
        aiNotice.value = 'Proposition générée. Relisez-la avant de l’enregistrer.';
    } catch (err: any) {
        aiError.value = err.response?.data?.message ?? 'L’analyse IA n’a pas pu être générée.';
    } finally {
        aiLoading.value = false;
    }
}

async function saveAiReview() {
    const latest = aiState.value.latest;
    if (!latest || aiSaving.value) return;
    aiSaving.value = true;
    aiError.value = '';
    aiNotice.value = '';
    try {
        const response = await reviewAiAnalysis(itemId.value, latest.id, {
            relevanceScore: clampInteger(aiDraft.value.relevanceScore, 0, 100) ?? 0,
            relevanceReason: aiDraft.value.relevanceReason,
            summary: aiDraft.value.summary || null,
            potentialImpacts: aiDraft.value.potentialImpacts.split('\n').map((value) => value.trim()).filter(Boolean),
            recommendedChecks: aiDraft.value.recommendedChecks.split('\n').map((value) => value.trim()).filter(Boolean),
            classification: {
                watchType: aiDraft.value.classificationWatchType,
                rationale: aiDraft.value.classificationRationale,
                themes: aiDraft.value.classificationThemes.split('\n').map((value) => value.trim()).filter(Boolean),
                domains: aiDraft.value.classificationDomains.split('\n').map((value) => value.trim()).filter(Boolean),
                keywords: aiDraft.value.classificationKeywords.split('\n').map((value) => value.trim()).filter(Boolean),
                keywordWeights: aiDraft.value.classificationKeywordWeights,
                laboratories: aiDraft.value.classificationLaboratories.split('\n').map((value) => value.trim()).filter(Boolean),
            },
        });
        aiState.value.latest = response.data;
        aiState.value.history = [response.data, ...aiState.value.history.filter((entry) => entry.id !== response.data.id)];
        prepareAiDraft(response.data);
        aiNotice.value = 'Votre relecture est enregistrée et tracée dans le journal d’audit.';
        actionSuccess(toast, 'Relecture humaine enregistrée', 'La nouvelle version est ajoutée à l’historique de cette veille et au journal d’audit.');
    } catch (err: any) {
        aiError.value = err.response?.data?.message ?? 'La relecture n’a pas pu être enregistrée.';
    } finally {
        aiSaving.value = false;
    }
}


const watchTypeOptions = [
    'SCIENTIFIQUE',
    'REGLEMENTAIRE',
    'ACCREDITATION',
    'NORMATIF',
    'ENVIRONNEMENT',
    'AUTRE',
];


const form =
    ref({
        watchType:
            '',

        relevance:
            null as
            number
            |
            null,

        topicIds:
            [] as number[],

        keywordIds:
            [] as number[],

        domainIds:
            [] as number[],

        laboratoryIds:
            [] as number[],
    });


const itemId =
    computed(
        () =>
            Number(
                route.params.id,
            ),
    );


function setRelevance(
    value:
        number
        |
        null
        |
        undefined,
) {
    form.value.relevance =
        clampInteger(
            value,
            0,
            100,
        );
}


const priorityScore =
    computed({
        get:
            () =>
                form.value.relevance
                ??
                0,

        set:
            (
                value:
                    number,
            ) => {
                setRelevance(
                    value,
                );
            },
    });


const priorityLabel =
    computed(
        () =>
            getPriorityLabel(
                priorityScore.value,
            ),
    );


const priorityColor =
    computed(
        () =>
            getPriorityColor(
                priorityScore.value,
            ),
    );


async function load() {
    loading.value =
        true;

    error.value =
        '';

    try {
        const [
            itemResponse,
            qualificationResponse,
            topicsResponse,
            keywordsResponse,
            domainsResponse,
            laboratoriesResponse,
        ] =
            await Promise.all([
                getWatchItem(
                    itemId.value,
                ),

                getQualification(
                    itemId.value,
                ),

                getTopics(),

                getKeywords(),

                getDomains(),

                getLaboratories(),
            ]);


        item.value =
            itemResponse.data;


        const qualification =
            qualificationResponse.data;


        form.value = {
            watchType:
                qualification.watchType,

            relevance:
                qualification.relevance,

            domainIds:
                qualification.domains
                    ?.map(
                        (domain) =>
                            domain.id,
                    )
                ??
                [],

            laboratoryIds:
                qualification.laboratories
                    ?.map(
                        (laboratory) =>
                            laboratory.id,
                    )
                ??
                [],

            topicIds:
                qualification.topicLinks
                    ?.map(
                        (link) =>
                            link.topic.id,
                    )
                ??
                [],

            keywordIds:
                qualification.keywordLinks
                    ?.map(
                        (link) =>
                            link.keyword.id,
                    )
                ??
                [],
        };


        topics.value =
            topicsResponse.data;

        keywords.value =
            keywordsResponse.data;


        domains.value =
            domainsResponse.data.filter(
                (domain) =>
                    domain.active
                    ||
                    form.value.domainIds.includes(
                        domain.id,
                    ),
            );


        laboratories.value =
            laboratoriesResponse.data.filter(
                (laboratory) =>
                    laboratory.active
                    ||
                    form.value.laboratoryIds.includes(
                        laboratory.id,
                    ),
            );

        await refreshAiAnalysis();

    } catch (
    err:
        any
    ) {
        error.value =
            err.response
                ?.data
                ?.message
            ??
            'Impossible de charger l’élément.';
    } finally {
        loading.value =
            false;
    }
}


async function submit() {
    if (
        saving.value
        ||
        loading.value
    ) {
        return;
    }

    error.value =
        '';

    success.value =
        '';


    if (
        form.value.relevance ===
        null
    ) {
        error.value =
            'La priorité doit être renseignée.';

        toast.add({
            severity:
                'warn',

            summary:
                'Champ obligatoire',

            detail:
                error.value,

            life:
                4500,
        });

        return;
    }


    saving.value =
        true;

    try {
        const response =
            await qualifyWatchItem(
                itemId.value,
                {
                    watchType:
                        form.value.watchType,

                    relevance:
                        form.value.relevance,

                    topicIds:
                        form.value.topicIds.filter((id) => id > 0),

                    keywordIds:
                        form.value.keywordIds.filter((id) => id > 0),

                    domainIds:
                        form.value.domainIds.filter((id) => id > 0),

                    laboratoryIds:
                        form.value.laboratoryIds.filter((id) => id > 0),

                    createMissingTaxonomy: aiClassificationReported.value,
                    topicLabels: aiClassificationReported.value ? aiDraft.value.classificationThemes.split('\n').map((value) => value.trim()).filter(Boolean) : [],
                    domainNames: aiClassificationReported.value ? aiDraft.value.classificationDomains.split('\n').map((value) => value.trim()).filter(Boolean) : [],
                    keywordLabels: aiClassificationReported.value ? aiDraft.value.classificationKeywords.split('\n').map((value) => value.trim()).filter(Boolean) : [],
                    keywordWeights: aiClassificationReported.value ? aiDraft.value.classificationKeywordWeights : [],
                    laboratoryNames: aiClassificationReported.value ? aiDraft.value.classificationLaboratories.split('\n').map((value) => value.trim()).filter(Boolean) : [],
                },
            );


        success.value =
            'Qualification enregistrée avec succès.';


        actionSuccess(
            toast,
            'Qualification enregistrée',
            'Les informations de qualification ont été enregistrées.',
        );


        item.value =
            response.data;

        await load();
    } catch (
    err:
        any
    ) {
        error.value =
            err.response
                ?.data
                ?.message
            ??
            'Impossible d’enregistrer la qualification.';

        actionError(
            toast,
            err,
            'Enregistrement impossible',
            'La qualification n’a pas pu être enregistrée.',
        );
    } finally {
        saving.value =
            false;
    }
}


onMounted(
    load,
);
</script>


<template>
    <AppLayout>

        <div class="qualification-page">

            <PageHeader title="Qualification" subtitle="Qualification métier et classement de l’élément de veille."
                eyebrow="Veille" icon="pi pi-check-circle">
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
            " severity="error">
                {{ error }}
            </Message>


            <Message v-if="
                success
            " severity="success">
                {{ success }}
            </Message>


            <AppSpinner v-if="
                loading
            " size="large" centered label="Chargement de la qualification…" />


            <template v-else-if="
                item
            ">

                <SectionCard :title="item.title
                    " :subtitle="`Source : ${item.source?.name ?? 'Non renseignée'}`
                        " icon="pi pi-file">

                    <div class="item-overview">

                        <div class="overview-meta">

                            <div>
                                <span>
                                    Statut
                                </span>

                                <Tag :value="labelFr(
                                    item.status,
                                )
                                    " />
                            </div>


                            <div v-if="
                                item.doi
                            ">
                                <span>
                                    DOI
                                </span>

                                <strong>
                                    {{ item.doi }}
                                </strong>
                            </div>

                        </div>


                        <details class="summary-block">
                            <summary>Afficher le résumé</summary>

                            <p>
                                {{
                                    item.summary
                                    ||
                                    'Aucun résumé disponible.'
                                }}
                            </p>
                        </details>


                        <a v-if="
                            safeExternalUrl(item.url)
                        " :href="safeExternalUrl(item.url) ?? undefined
                            " target="_blank" rel="noopener noreferrer" class="source-link">
                            <i class="pi pi-external-link" />

                            Consulter la source originale
                        </a>

                    </div>

                </SectionCard>


                <SectionCard title="Aide à la qualification par IA"
                    subtitle="Les résultats sont des propositions à vérifier ; la décision reste humaine."
                    icon="pi pi-sparkles">
                    <div class="ai-analysis">
                        <Message v-if="!aiState.enabled" severity="info">
                            Le service IA est désactivé. Configurez explicitement la clé API et l’autorisation de
                            traitement externe dans l’environnement du backend.
                        </Message>
                        <Message v-if="aiState.autoAnalysisEnabled" severity="success">
                            L’analyse automatique est activée après l’ajout ou la mise à jour d’une veille.
                        </Message>
                        <Message v-if="aiError" severity="error">{{ aiError }}</Message>
                        <Message v-if="aiNotice" severity="success">{{ aiNotice }}</Message>
                        <div class="ai-primary-actions">
                            <Button :label="aiState.latest ? 'Actualiser la proposition' : 'Analyser cette veille'"
                                icon="pi pi-sparkles" :loading="aiLoading" :disabled="!aiState.enabled"
                                @click="runAiAnalysis" />
                            <Button v-if="aiState.latest" label="Récupérer dans la qualification"
                                icon="pi pi-arrow-down" severity="secondary" @click="applyAiClassification" />
                        </div>

                        <template v-if="aiState.latest">
                            <div class="ai-proposal-meta">
                                <Tag :value="aiState.latest.status === 'REVIEWED' ? 'Relue par un utilisateur' : 'Proposition à vérifier'"
                                    :severity="aiState.latest.status === 'REVIEWED' ? 'success' : 'warn'" />
                                <span>Modèle : {{ aiState.latest.model }} · {{ new
                                    Date(aiState.latest.createdAt).toLocaleString('fr-FR') }}</span>
                            </div>
                            <div class="ai-score-summary">
                                <div class="ai-field">
                                    <label for="ai-score">Pertinence estimée</label>
                                    <input id="ai-score" v-model.number="aiDraft.relevanceScore" type="number" min="0"
                                        max="100" />
                                </div>
                                <p>{{ aiDraft.relevanceReason || 'Aucune justification fournie.' }}</p>
                            </div>
                            <Button :label="aiDetailsExpanded ? 'Masquer les détails' : 'Voir les détails de l’analyse'"
                                severity="secondary" text @click="aiDetailsExpanded = !aiDetailsExpanded" />
                            <div v-if="aiDetailsExpanded" class="ai-extra-details">
                                <div class="ai-field">
                                    <label for="ai-reason">Justification</label>
                                    <textarea id="ai-reason" v-model="aiDraft.relevanceReason" rows="3"
                                        maxlength="2000" />
                                </div>
                                <div class="ai-field">
                                    <label for="ai-summary">Résumé proposé</label>
                                    <textarea id="ai-summary" v-model="aiDraft.summary" rows="4" maxlength="6000" />
                                </div>
                                <div class="ai-field">
                                    <label for="ai-impacts">Impacts potentiels (un par ligne)</label>
                                    <textarea id="ai-impacts" v-model="aiDraft.potentialImpacts" rows="3"
                                        maxlength="4000" />
                                </div>
                                <div class="ai-field">
                                    <label for="ai-checks">Vérifications suggérées (une par ligne)</label>
                                    <textarea id="ai-checks" v-model="aiDraft.recommendedChecks" rows="3"
                                        maxlength="4000" />
                                </div>
                                <div class="ai-classification">
                                    <h3>Classification proposée</h3>
                                    <p class="ai-disclaimer">Les libellés sont des suggestions générées à partir du
                                        contenu, sans envoi du catalogue interne. Corrigez-les si nécessaire, puis
                                        rapprochez-les des choix de taxonomie plus bas.</p>
                                    <div class="ai-field">
                                        <label for="ai-watch-type">Catégorie de veille proposée</label>
                                        <Select id="ai-watch-type" v-model="aiDraft.classificationWatchType"
                                            :options="optionsFr(watchTypeOptions)" option-label="label"
                                            option-value="value" class="w-full" />
                                    </div>
                                    <div class="ai-field">
                                        <label for="ai-themes">Thèmes proposés (un par ligne)</label>
                                        <textarea id="ai-themes" v-model="aiDraft.classificationThemes" rows="2"
                                            maxlength="2000" />
                                    </div>
                                    <div class="ai-field">
                                        <label for="ai-domains">Domaines proposés (un par ligne)</label>
                                        <textarea id="ai-domains" v-model="aiDraft.classificationDomains" rows="2"
                                            maxlength="2000" />
                                    </div>
                                    <div class="ai-field">
                                        <label for="ai-keywords">Mots-clés proposés (un par ligne)</label>
                                        <textarea id="ai-keywords" v-model="aiDraft.classificationKeywords" rows="2"
                                            maxlength="2000" />
                                        <small>Le poids de chaque mot-clé est proposé par l’IA selon son importance et
                                            n’est pas affiché ici.</small>
                                    </div>
                                    <div class="ai-field">
                                        <label for="ai-labs">Laboratoire ou service potentiellement concerné</label>
                                        <textarea id="ai-labs" v-model="aiDraft.classificationLaboratories" rows="2"
                                            maxlength="2000" />
                                    </div>
                                    <div class="ai-field">
                                        <label for="ai-classification-reason">Justification de la classification</label>
                                        <textarea id="ai-classification-reason"
                                            v-model="aiDraft.classificationRationale" rows="2" maxlength="2000" />
                                    </div>
                                    <div class="ai-classification-actions">
                                        <Button label="Reporter dans la qualification" icon="pi pi-arrow-down"
                                            severity="secondary" @click="applyAiClassification" />
                                        <Button v-if="canRejectFromQualification" label="Rejeter cette veille"
                                            icon="pi pi-times" severity="danger" :loading="aiSaving"
                                            @click="rejectAiSuggestion" />
                                    </div>
                                </div>
                            </div>
                            <p class="ai-disclaimer">Ces éléments décrivent des impacts possibles et ne constituent pas
                                une conclusion de conformité.</p>
                            <Button label="Enregistrer la relecture humaine" icon="pi pi-check" :loading="aiSaving"
                                @click="saveAiReview" />
                        </template>
                        <Dialog v-model:visible="rejectDialogVisible" modal :closable="!aiSaving"
                            :dismissable-mask="!aiSaving" header="Rejeter cette veille" class="ai-reject-dialog">
                            <p>Cette veille sera marquée comme rejetée. Le score IA proposé est de <strong>{{
                                aiDraft.relevanceScore
                            }}/100</strong>.</p>
                            <p class="ai-dialog-note">Le rejet est une décision humaine et sera enregistré dans le suivi
                                ainsi que dans le
                                journal d’audit.</p>
                            <template #footer>
                                <Button label="Annuler" severity="secondary" text :disabled="aiSaving"
                                    @click="rejectDialogVisible = false" />
                                <Button label="Confirmer le rejet" icon="pi pi-times" severity="danger"
                                    :loading="aiSaving" @click="confirmRejectAiSuggestion" />
                            </template>
                        </Dialog>
                        <details v-if="aiState.history.length" class="ai-history">
                            <summary>Historique complet des analyses ({{ aiState.history.length }})</summary>
                            <ol class="ai-history-list">
                                <li v-for="entry in aiState.history" :key="entry.id" class="ai-history-entry">
                                    <div class="ai-history-heading">
                                        <Tag :value="entry.status === 'REVIEWED' ? 'Relue' : 'Proposition IA'"
                                            :severity="entry.status === 'REVIEWED' ? 'success' : 'info'" />
                                        <strong>{{ new Date(entry.createdAt).toLocaleString('fr-FR') }}</strong>
                                        <span v-if="entry.reviewedBy">par {{ [entry.reviewedBy.firstName,
                                        entry.reviewedBy.lastName].filter(Boolean).join(' ') ||
                                            entry.reviewedBy.email }}</span>
                                        <span v-else>{{ entry.provider }} · {{ entry.model }}</span>
                                    </div>
                                    <p><b>Pertinence : {{ entry.relevanceScore }}/100.</b> {{ entry.relevanceReason }}
                                    </p>
                                    <p v-if="entry.summary"><b>Résumé :</b> {{ entry.summary }}</p>
                                    <p v-if="entry.supersedesId" class="ai-history-parent">Version précédente : #{{
                                        entry.supersedesId }}</p>
                                </li>
                            </ol>
                        </details>
                        <p v-else-if="aiState.enabled" class="ai-empty">Aucune proposition pour cette veille. Lancez une
                            analyse pour commencer.
                        </p>
                    </div>
                </SectionCard>

                <SectionCard title="Qualification métier"
                    subtitle="Classez la veille, associez les taxonomies et définissez sa priorité."
                    icon="pi pi-sliders-h">

                    <form ref="qualificationFormRef" class="qualification-form" @submit.prevent="
                        submit
                    ">

                        <Message v-if="pendingTaxonomyLabels.length" severity="info" :closable="false">
                            Suggestions reportées : {{ pendingTaxonomyLabels.join(' · ') }}. Les libellés absents seront
                            créés lors de
                            l’enregistrement.
                        </Message>

                        <div class="form-grid">

                            <div class="field-group">
                                <label>
                                    Type de veille
                                </label>

                                <div class="select-host">
                                    <Select append-to="self" v-model="form.watchType
                                        " option-label="label" option-value="value" :options="optionsFr(
                                            watchTypeOptions,
                                        )
                                            " class="w-full" />
                                </div>
                            </div>


                            <div class="priority-panel">

                                <div class="priority-heading">

                                    <div>
                                        <span class="priority-title required-label">
                                            Priorité globale
                                        </span>

                                    </div>


                                    <strong :style="{
                                        color:
                                            priorityColor,
                                    }">
                                        {{ priorityScore }} / 100 · {{ priorityLabel }}
                                    </strong>

                                </div>


                                <Slider aria-label="Priorité globale" v-model="priorityScore
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



                            </div>


                            <div class="field-group">
                                <label>
                                    Domaines
                                </label>

                                <div class="select-host">
                                    <MultiSelect append-to="self" v-model="form.domainIds
                                        " :options="domains
                                            " option-label="name" option-value="id" filter placeholder="Sélectionner"
                                        class="w-full" />
                                </div>
                            </div>


                            <div class="field-group">
                                <label>
                                    Laboratoires
                                </label>

                                <div class="select-host">
                                    <MultiSelect append-to="self" v-model="form.laboratoryIds
                                        " :options="laboratories
                                            " option-label="name" option-value="id" filter placeholder="Sélectionner"
                                        class="w-full" />
                                </div>
                            </div>


                            <div class="field-group">
                                <label>
                                    Thèmes
                                </label>

                                <div class="select-host">
                                    <MultiSelect append-to="self" v-model="form.topicIds
                                        " :options="topics
                                            " option-label="label" option-value="id" filter placeholder="Sélectionner"
                                        class="w-full" />
                                </div>
                            </div>


                            <div class="field-group">
                                <label>
                                    Mots-clés
                                </label>

                                <div class="select-host">
                                    <MultiSelect append-to="self" v-model="form.keywordIds
                                        " :options="keywords
                                            " option-label="label" option-value="id" filter placeholder="Sélectionner"
                                        class="w-full" />
                                </div>
                            </div>

                        </div>


                        <div class="form-actions">

                            <Button type="button" label="Annuler" severity="secondary" @click="returnToWatchItems" />

                            <Button type="submit" label="Enregistrer la qualification" :loading="saving
                                " />

                        </div>

                    </form>

                </SectionCard>

            </template>

        </div>

    </AppLayout>
</template>


<style scoped>
.qualification-page {
    display:
        grid;

    max-width:
        72rem;

    margin:
        0 auto;

    gap:
        1rem;
}

.item-overview {
    display:
        grid;

    gap:
        0.6rem;
}

.overview-meta {
    display:
        flex;

    flex-wrap:
        wrap;

    gap:
        1.5rem;
}

.overview-meta>div {
    display:
        grid;

    gap:
        0.35rem;
}

.overview-meta span,
.summary-block>summary {
    color:
        var(--app-text-muted);

    font-size:
        0.66rem;

    font-weight:
        700;

    text-transform:
        uppercase;
}

.summary-block>summary {
    cursor: pointer;
    width: fit-content;
}

.summary-block[open]>summary {
    margin-bottom: 0.4rem;
}

.overview-meta strong {
    color:
        var(--app-text-secondary);

    font-size:
        0.75rem;
}

.summary-block p {
    margin:
        0;

    color:
        var(--app-text-secondary);

    font-size:
        0.78rem;

    line-height:
        1.6;

    white-space:
        pre-line;
}

.ai-analysis {
    display: grid;
    gap: 0.8rem;
}

.ai-primary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    align-items: center;
}

.ai-proposal-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.7rem;
    color: var(--app-text-muted);
    font-size: 0.75rem;
}

.ai-score-summary {
    display: grid;
    grid-template-columns: minmax(7rem, 0.25fr) 1fr;
    gap: 0.8rem;
    align-items: center;
    padding: 0.8rem;
    border-radius: 0.75rem;
    background: var(--app-surface-2);
}

.ai-score-summary p {
    margin: 0;
    color: var(--app-text-secondary);
    font-size: 0.82rem;
    line-height: 1.5;
}

.ai-extra-details {
    display: grid;
    gap: 0.8rem;
    padding: 0.85rem;
    border: 1px solid var(--app-border, #cbd5e1);
    border-radius: 0.8rem;
}

.ai-extra-details small {
    color: var(--app-text-muted);
    font-size: 0.72rem;
}

.ai-history {
    border-top: 1px solid var(--app-border, #cbd5e1);
    padding-top: 0.75rem;
}

.ai-history summary {
    cursor: pointer;
    color: var(--app-text-secondary);
    font-size: 0.82rem;
    font-weight: 700;
}

.ai-history-list {
    display: grid;
    gap: 0.6rem;
    margin: 0.7rem 0 0;
    padding-left: 1.2rem;
}

.ai-history-entry {
    padding: 0.75rem;
    border-radius: 0.7rem;
    background: var(--app-surface-2);
    color: var(--app-text-secondary);
    font-size: 0.78rem;
    line-height: 1.45;
}

.ai-history-heading {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
    color: var(--app-text-muted);
    font-size: 0.72rem;
}

.ai-history-entry p {
    margin: 0.45rem 0 0;
}

.ai-history-parent {
    font-size: 0.7rem;
}

.ai-field {
    display: grid;
    gap: 0.35rem;
}

.ai-field label {
    color: var(--app-text-secondary);
    font-size: 0.76rem;
    font-weight: 700;
}

.ai-field input,
.ai-field textarea {
    width: 100%;
    border: 1px solid var(--app-border, #cbd5e1);
    border-radius: 0.65rem;
    padding: 0.65rem 0.75rem;
    color: var(--app-text-primary);
    background: var(--app-surface, #fff);
    font: inherit;
    font-size: 0.82rem;
}

.ai-field textarea {
    resize: vertical;
    line-height: 1.5;
}

.ai-classification {
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
    border: 1px solid var(--app-border, #cbd5e1);
    border-radius: 0.8rem;
}

.ai-classification-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    align-items: center;
}

.ai-classification h3 {
    margin: 0;
    color: var(--app-text-primary);
    font-size: 0.95rem;
}

.ai-disclaimer,
.ai-empty {
    margin: 0;
    color: var(--app-text-muted);
    font-size: 0.76rem;
    line-height: 1.5;
}

.source-link {
    display:
        inline-flex;

    width:
        fit-content;

    align-items:
        center;

    gap:
        0.4rem;

    color:
        var(--app-blue);

    font-size:
        0.74rem;

    font-weight:
        650;
}

.qualification-form {
    display:
        grid;

    gap:
        0.8rem;
}

.form-grid {
    align-items: center;
    display:
        grid;

    grid-template-columns:
        repeat(2,
            minmax(0,
                1fr));

    gap:
        0.75rem 1rem;
}

.field-group {
    min-width: 0;
    display:
        grid;

    gap:
        0.3rem;
}

.field-group label,
.priority-title {
    color:
        var(--app-text-secondary);

    font-size:
        0.74rem;

    font-weight:
        700;
}

.priority-panel {
    display:
        grid;

    gap:
        0.6rem;

    padding:
        0.65rem 0.85rem;

    border-radius:
        0.85rem;

    background:
        var(--app-surface-2);
}

.priority-heading {
    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    gap:
        0.5rem;
    flex-wrap: wrap;
}

.priority-heading>strong {
    font-size:
        0.85rem;
}

.priority-scale {
    display:
        flex;

    justify-content:
        space-between;

    color:
        var(--app-text-muted);

    font-size:
        0.62rem;
}

.form-actions {
    flex-wrap: wrap;
    display:
        flex;

    justify-content:
        flex-end;

    gap:
        0.65rem;
}

@media (max-width: 700px) {
    .form-grid {
        grid-template-columns:
            1fr;
    }

    .priority-panel {
        grid-column:
            auto;
    }
}
</style>
