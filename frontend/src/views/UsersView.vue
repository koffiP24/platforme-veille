<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
} from 'vue';

import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import MultiSelect from 'primevue/multiselect';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';

import {
  useToast,
} from 'primevue/usetoast';

import {
  isAxiosError,
} from 'axios';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';

import api from '../services/api';

import {
  labelFr,
} from '../i18n/labels';

import {
  useAuthStore,
} from '../stores/auth';


interface UserRole {
  id:
  number;

  name:
  string;

  description:
  string | null;
}


interface UserRow {
  id:
  number;

  firstName:
  string;

  lastName:
  string;

  email:
  string;

  status:
  'ACTIVE'
  |
  'INACTIVE';

  mustChangePassword?: boolean;

  roles:
  UserRole[];
}


const auth =
  useAuthStore();

const toast =
  useToast();

const users =
  ref<UserRow[]>([]);

const userSearch = ref('');

const filteredUsers = computed(() => {
  const query = userSearch.value.trim().toLocaleLowerCase('fr');
  if (!query) return users.value;
  return users.value.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email} ${user.roles.map((role) => role.name).join(' ')}`
      .toLocaleLowerCase('fr')
      .includes(query),
  );
});

const availableRoles =
  ref<UserRole[]>([]);

const loading =
  ref(false);

const statusError =
  ref('');

const changingStatus =
  ref<number[]>([]);

const dialogVisible =
  ref(false);

const creating =
  ref(false);

const useAutoTemporaryPassword = ref(true);
const tempPasswordDialogVisible = ref(false);
const createdUserData = ref<{ name: string; email: string; password: string } | null>(null);
const copied = ref(false);

async function copyTemporaryPassword() {
  if (!createdUserData.value?.password) return;
  try {
    await navigator.clipboard.writeText(createdUserData.value.password);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 3000);
  } catch {
    /* ignore fallback */
  }
}

async function resetTemporaryPassword(user: UserRow) {
  try {
    const response = await api.post<{ temporaryPassword: string }>(`/users/${user.id}/temporary-password`);
    createdUserData.value = {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      password: response.data.temporaryPassword,
    };
    tempPasswordDialogVisible.value = true;
    await loadUsers();
    toast.add({
      severity: 'info',
      summary: 'Mot de passe temporaire',
      detail: `Un mot de passe temporaire a été généré pour ${user.firstName} ${user.lastName}.`,
      life: 5000,
    });
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: apiError(err, 'Impossible de générer le mot de passe temporaire.'),
      life: 4000,
    });
  }
}

const error =
  ref('');

const form =
  ref({
    firstName:
      '',

    lastName:
      '',

    email:
      '',

    password:
      '',

    roles:
      [] as string[],
  });

// Reset on opening and closing, including cancellation.
watch(dialogVisible, () => {
  form.value = { firstName: '', lastName: '', email: '', password: '', roles: [] };
  useAutoTemporaryPassword.value = true;
  error.value = '';
}, { flush: 'sync' });

const roleDialogVisible =
  ref(false);

const selectedUser =
  ref<UserRow | null>(
    null,
  );

const selectedRoleNames =
  ref<string[]>([]);

const roleError =
  ref('');

const savingRoles =
  ref(false);


const roleOptions =
  computed(
    () =>
      availableRoles.value.map(
        (role) => ({
          label:
            labelFr(
              role.name,
            ),

          value:
            role.name,
        }),
      ),
  );

const passwordRules = computed(() => {
  const value = form.value.password;
  return [
    { label: '12 caractères minimum', valid: value.length >= 12 },
    { label: 'Une lettre minuscule', valid: /[a-z]/.test(value) },
    { label: 'Une lettre majuscule', valid: /[A-Z]/.test(value) },
    { label: 'Un chiffre', valid: /\d/.test(value) },
    { label: 'Un caractère spécial', valid: /[^A-Za-z0-9]/.test(value) },
  ];
});

const passwordScore = computed(
  () => passwordRules.value.filter((rule) => rule.valid).length,
);

const passwordValid = computed(
  () => passwordScore.value === passwordRules.value.length,
);

const passwordStrength = computed(() => {
  if (!form.value.password) return { label: 'À renseigner', className: 'password-empty' };
  if (passwordScore.value <= 2) return { label: 'Faible', className: 'password-weak' };
  if (!passwordValid.value) return { label: 'Moyen', className: 'password-medium' };
  return { label: 'Fort', className: 'password-strong' };
});


function formatUserRoles(
  roles:
    UserRole[],
) {
  if (
    !roles.length
  ) {
    return 'Aucun rôle';
  }

  const available =
    new Set(
      availableRoles.value.map(
        (role) =>
          role.name,
      ),
    );

  const current =
    new Set(
      roles.map(
        (role) =>
          role.name,
      ),
    );

  const hasAll =
    available.size > 0
    &&
    available.size ===
    current.size
    &&
    [
      ...available,
    ].every(
      (role) =>
        current.has(
          role,
        ),
    );

  if (
    hasAll
  ) {
    return 'Tous les rôles';
  }

  return roles
    .map(
      (role) =>
        labelFr(
          role.name,
        ),
    )
    .join(
      ', ',
    );
}


function apiError(
  err:
    unknown,

  fallback:
    string,
) {
  const message =
    isAxiosError(
      err,
    )
      ? err.response
        ?.data
        ?.message
      : undefined;

  return typeof message ===
    'string'
    ? message
    : fallback;
}


async function loadUsers() {
  loading.value =
    true;

  statusError.value =
    '';

  try {
    const [
      usersResponse,
      rolesResponse,
    ] =
      await Promise.all([
        api.get<UserRow[]>(
          '/users',
        ),

        api.get<UserRole[]>(
          '/roles',
        ),
      ]);

    users.value =
      usersResponse.data;

    availableRoles.value =
      rolesResponse.data;
  } catch (
  err:
    unknown
  ) {
    statusError.value =
      apiError(
        err,
        'Impossible de charger les utilisateurs et les rôles.',
      );
  } finally {
    loading.value =
      false;
  }
}


async function createUser() {
  if (
    creating.value
  ) {
    return;
  }

  error.value =
    '';

  if (!useAutoTemporaryPassword.value && !passwordValid.value) {
    error.value = 'Le mot de passe ne respecte pas toutes les règles de sécurité.';
    return;
  }

  creating.value =
    true;

  try {
    const payload = {
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      email: form.value.email,
      roles: form.value.roles,
      temporaryPassword: useAutoTemporaryPassword.value,
      ...(useAutoTemporaryPassword.value ? {} : { password: form.value.password }),
    };

    const response = await api.post(
      '/users',
      payload,
    );

    dialogVisible.value =
      false;

    form.value = {
      firstName:
        '',

      lastName:
        '',

      email:
        '',

      password:
        '',

      roles:
        [],
    };

    await loadUsers();

    if (response.data?.temporaryPassword) {
      createdUserData.value = {
        name: `${response.data.firstName} ${response.data.lastName}`,
        email: response.data.email,
        password: response.data.temporaryPassword,
      };
      tempPasswordDialogVisible.value = true;
    } else {
      toast.add({
        severity:
          'success',

        summary:
          'Utilisateur créé',

        detail:
          'Le compte a été créé avec succès.',

        life:
          5000,
      });
    }
  } catch (
  err:
    unknown
  ) {
    error.value =
      apiError(
        err,
        'Création impossible.',
      );
  } finally {
    creating.value =
      false;
  }
}


function editRoles(
  user:
    UserRow,
) {
  selectedUser.value =
    user;

  selectedRoleNames.value =
    user.roles.map(
      (role) =>
        role.name,
    );

  roleError.value =
    '';

  roleDialogVisible.value =
    true;
}


async function saveRoles() {
  const user =
    selectedUser.value;

  if (
    !user
    ||
    savingRoles.value
  ) {
    return;
  }

  roleError.value =
    '';

  if (
    !selectedRoleNames.value.length
  ) {
    roleError.value =
      'Sélectionne au moins un rôle.';

    return;
  }

  if (
    user.id ===
    auth.user?.id
    &&
    !selectedRoleNames.value.includes(
      'ADMIN',
    )
  ) {
    roleError.value =
      'Vous devez conserver votre propre rôle Administrateur.';

    return;
  }

  savingRoles.value =
    true;

  try {
    const response =
      await api.patch<{
        id:
        number;

        roles:
        UserRole[];
      }>(
        `/users/${user.id}/roles`,
        {
          roles:
            selectedRoleNames.value,
        },
      );

    user.roles =
      response.data.roles;

    if (
      user.id ===
      auth.user?.id
    ) {
      auth.user.roles =
        response.data.roles.map(
          (role) =>
            role.name,
        );

      sessionStorage.setItem(
        'veille_current_user',
        JSON.stringify(
          auth.user,
        ),
      );
    }

    roleDialogVisible.value =
      false;

    toast.add({
      severity:
        'success',

      summary:
        'Rôles modifiés',

      detail:
        `Les rôles de ${user.firstName} ${user.lastName} ont été enregistrés.`,

      life:
        5000,
    });
  } catch (
  err:
    unknown
  ) {
    roleError.value =
      apiError(
        err,
        'Impossible de modifier les rôles de cet utilisateur.',
      );
  } finally {
    savingRoles.value =
      false;
  }
}


async function changeStatus(
  id:
    number,

  status:
    'ACTIVE'
    |
    'INACTIVE',
) {
  if (
    !auth.isAdmin
    ||
    changingStatus.value.includes(
      id,
    )
  ) {
    return;
  }

  statusError.value =
    '';

  changingStatus.value.push(
    id,
  );

  try {
    const response =
      await api.patch<{
        id:
        number;

        status:
        UserRow['status'];
      }>(
        `/users/${id}/status`,
        {
          status,
        },
      );

    const user =
      users.value.find(
        (item) =>
          item.id ===
          id,
      );

    if (
      user
    ) {
      user.status =
        response.data.status;
    }
  } catch (
  err:
    unknown
  ) {
    statusError.value =
      apiError(
        err,
        'Impossible de modifier le statut du compte.',
      );
  } finally {
    changingStatus.value =
      changingStatus.value.filter(
        (item) =>
          item !==
          id,
      );
  }
}


onMounted(
  loadUsers,
);
</script>


<template>
  <AppLayout>

    <div class="users-page">

      <PageHeader title="Utilisateurs" subtitle="Gestion des comptes, des rôles et de l’accès à la plateforme."
        eyebrow="Administration" icon="pi pi-users">
        <template #actions>
          <Button label="Ajouter un utilisateur" icon="pi pi-plus" @click="
            dialogVisible =
            true
            " />
        </template>
      </PageHeader>


      <Message v-if="
        statusError
      " severity="error">
        {{ statusError }}
      </Message>


      <SectionCard title="Comptes utilisateurs" :subtitle="`${users.length} utilisateur${users.length > 1 ? 's' : ''} enregistré${users.length > 1 ? 's' : ''}`
        " icon="pi pi-address-book">

        <InputText v-model="userSearch" placeholder="Rechercher un utilisateur..." class="user-search" />

        <DataTable :value="filteredUsers
          " :loading="loading
            " data-key="id" paginator :rows="10
              " :rows-per-page-options="[
              10,
              20,
              50,
            ]
              ">

          <template #empty>
            Aucun utilisateur disponible.
          </template>


          <Column field="id" header="ID" style="width: 4rem" />


          <Column header="Utilisateur" style="min-width: 12rem">
            <template #body="{ data }">

              <div class="user-cell">

                <div class="user-avatar">
                  {{
                    (
                      `${data.firstName?.[0] ?? ''}${data.lastName?.[0] ?? ''}`
                    ).toUpperCase()
                  }}
                </div>

                <div>
                  <strong>
                    {{ data.firstName }}
                    {{ data.lastName }}
                  </strong>

                  <span>
                    {{ data.email }}
                  </span>
                </div>

              </div>

            </template>
          </Column>


          <Column header="Rôles" style="min-width: 15rem">
            <template #body="{ data }">
              <span class="roles-text">
                {{
                  formatUserRoles(
                    data.roles,
                  )
                }}
              </span>
            </template>
          </Column>


          <Column header="Statut" style="min-width: 9rem">
            <template #body="{ data }">
              <div class="flex items-center gap-1.5 flex-wrap">
                <StatusBadge :status="data.status" />
                <Tag v-if="data.mustChangePassword" value="MDP temp." severity="warn" class="text-xs font-semibold" title="Changement obligatoire du mot de passe à la prochaine connexion" />
              </div>
            </template>
          </Column>


          <Column v-if="
            auth.isAdmin
          " header="Actions" style="width: 8rem">
            <template #body="{ data }">

              <div class="row-actions">

                <Button icon="pi pi-user-edit" severity="secondary" rounded size="small" aria-label="Modifier les rôles"
                  title="Modifier les rôles" @click="
                    editRoles(
                      data,
                    )
                    " />

                <Button icon="pi pi-key" severity="warn" rounded size="small" aria-label="Générer un mot de passe temporaire"
                  title="Générer un mot de passe temporaire" @click="
                    resetTemporaryPassword(
                      data,
                    )
                    " />


                <Button v-if="
                  data.status ===
                  'ACTIVE'
                " icon="pi pi-user-minus" severity="danger" rounded size="small" aria-label="Désactiver"
                  title="Désactiver" :loading="changingStatus.includes(
                    data.id,
                  )
                    " :disabled="data.id ===
                      auth.user?.id
                      ||
                      changingStatus.includes(
                        data.id,
                      )
                      " @click="
                      changeStatus(
                        data.id,
                        'INACTIVE',
                      )
                      " />


                <Button v-else icon="pi pi-user-plus" severity="success" rounded size="small" aria-label="Réactiver"
                  title="Réactiver" :loading="changingStatus.includes(
                    data.id,
                  )
                    " :disabled="changingStatus.includes(
                      data.id,
                    )
                      " @click="
                      changeStatus(
                        data.id,
                        'ACTIVE',
                      )
                      " />

              </div>

            </template>
          </Column>

        </DataTable>

      </SectionCard>


      <Dialog v-model:visible="roleDialogVisible
        " modal header="Modifier les rôles" class="w-full max-w-xl" :closable="!savingRoles
          " :close-on-escape="!savingRoles
            ">

        <form class="space-y-5" @submit.prevent="
          saveRoles
        ">

          <div v-if="
            selectedUser
          " class="dialog-user">
            <div class="dialog-avatar">
              {{
                (
                  `${selectedUser.firstName?.[0] ?? ''}${selectedUser.lastName?.[0] ?? ''}`
                ).toUpperCase()
              }}
            </div>

            <div>
              <strong>
                {{ selectedUser.firstName }}
                {{ selectedUser.lastName }}
              </strong>

              <span>
                {{ selectedUser.email }}
              </span>
            </div>
          </div>


          <Message v-if="
            roleError
          " severity="error">
            {{ roleError }}
          </Message>


          <div class="select-host">
            <label for="user-roles" class="required-label mb-2 block font-medium">
              Rôles attribués
            </label>

            <MultiSelect append-to="self" id="user-roles" v-model="selectedRoleNames
              " :options="roleOptions
                " option-label="label" option-value="value" filter class="w-full"
              placeholder="Choisir un ou plusieurs rôles" :disabled="savingRoles
                " />
          </div>


          <Message v-if="
            selectedUser?.id ===
            auth.user?.id
          " severity="info" :closable="false
            ">
            Vous pouvez ajouter des rôles
            à votre compte mais vous devez
            conserver le rôle Administrateur.
          </Message>


          <div class="dialog-actions">
            <Button type="button" label="Annuler" severity="secondary" :disabled="savingRoles
              " @click="
                roleDialogVisible =
                false
                " />

            <Button type="submit" label="Enregistrer" :loading="savingRoles
              " />
          </div>

        </form>

      </Dialog>


      <Dialog v-model:visible="dialogVisible
        " modal header="Nouvel utilisateur" class="w-full max-w-xl" :closable="!creating
          " :close-on-escape="!creating
            ">

        <form class="space-y-4" autocomplete="off" @submit.prevent="
          createUser
        ">

          <Message v-if="
            error
          " severity="error">
            {{ error }}
          </Message>


          <div class="grid gap-4 md:grid-cols-2">

            <div>
              <label class="required-label mb-2 block">
                Prénom
              </label>

              <InputText v-model="form.firstName
                " class="w-full" required />
            </div>


            <div>
              <label class="required-label mb-2 block">
                Nom
              </label>

              <InputText v-model="form.lastName
                " class="w-full" required />
            </div>

          </div>


          <div>
            <label class="required-label mb-2 block">
              Adresse électronique
            </label>

            <InputText v-model="form.email
              " type="email" name="new-user-email" autocomplete="off" class="w-full" required />
          </div>


          <div class="p-3 bg-amber-50/70 rounded-lg border border-amber-200">
            <div class="flex items-center gap-2">
              <Checkbox v-model="useAutoTemporaryPassword" inputId="auto-temp-pwd" :binary="true" />
              <label for="auto-temp-pwd" class="text-sm font-semibold cursor-pointer text-slate-800">
                Générer un mot de passe temporaire aléatoire (recommandé)
              </label>
            </div>
            <p class="text-xs text-slate-600 mt-1 pl-6">
              Le mot de passe sécurisé vous sera affiché dès la validation pour transmission. L’utilisateur sera forcé de le changer à sa première connexion.
            </p>
          </div>

          <div v-if="!useAutoTemporaryPassword">
            <label class="required-label mb-2 block">
              Mot de passe initial
            </label>

            <Password v-model="form.password
              " :feedback="false
                " :input-props="{ name: 'new-user-password', autocomplete: 'new-password' }" toggle-mask fluid
              :required="!useAutoTemporaryPassword" />

            <div class="password-strength" :class="passwordStrength.className">
              <div class="password-strength-head">
                <span>Sécurité du mot de passe</span>
                <strong>{{ passwordStrength.label }}</strong>
              </div>
              <div class="password-meter" aria-hidden="true">
                <span :style="{ width: `${passwordScore * 20}%` }" />
              </div>
              <ul class="password-rules">
                <li v-for="rule in passwordRules" :key="rule.label" :class="{ valid: rule.valid }">
                  <i :class="rule.valid ? 'pi pi-check-circle' : 'pi pi-circle'" />
                  {{ rule.label }}
                </li>
              </ul>
            </div>
          </div>


          <div class="select-host">
            <label class="required-label mb-2 block">
              Rôles
            </label>

            <MultiSelect append-to="self" v-model="form.roles
              " :options="roleOptions
                " option-label="label" option-value="value" filter class="w-full"
              placeholder="Choisir un ou plusieurs rôles" required />
          </div>


          <div class="dialog-actions">

            <Button type="button" label="Annuler" severity="secondary" :disabled="creating
              " @click="
                dialogVisible =
                false
                " />

            <Button type="submit" label="Créer l'utilisateur" :loading="creating
            " :disabled="(!useAutoTemporaryPassword && !passwordValid) || !form.roles.length" />

          </div>

        </form>

      </Dialog>

    </div>


    <!-- Dialog d'affichage du mot de passe temporaire -->
    <Dialog v-model:visible="tempPasswordDialogVisible" modal header="Mot de passe temporaire généré" class="w-full max-w-lg">
      <div class="space-y-4">
        <div class="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-sm">
          <p class="font-semibold flex items-center gap-1.5">
            <i class="pi pi-shield text-amber-600"></i>
            Mot de passe à usage unique
          </p>
          <p class="text-xs mt-1 text-amber-800">
            L'utilisateur sera <strong>obligé de choisir un nouveau mot de passe</strong> lors de sa première connexion avant d'accéder à l'application.
          </p>
        </div>

        <div class="bg-slate-50 p-3 rounded border">
          <div class="text-xs text-slate-500 mb-1">Compte concerné :</div>
          <div class="font-semibold text-slate-900">{{ createdUserData?.name }}</div>
          <div class="text-xs text-slate-600 font-mono">{{ createdUserData?.email }}</div>
        </div>

        <div>
          <div class="text-xs text-slate-500 mb-1.5 font-medium">Mot de passe temporaire :</div>
          <div class="flex items-center gap-2">
            <code class="temp-pwd-box">{{ createdUserData?.password }}</code>
            <Button
              :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
              :label="copied ? 'Copié !' : 'Copier'"
              :severity="copied ? 'success' : 'secondary'"
              @click="copyTemporaryPassword"
            />
          </div>
        </div>

        <p class="text-xs text-slate-500 italic">
          Transmettez ce mot de passe de façon sécurisée à l'utilisateur. Pour des raisons de sécurité, il ne sera plus affiché après la fermeture de cette boîte.
        </p>
      </div>

      <template #footer>
        <Button label="Fermer" severity="primary" @click="tempPasswordDialogVisible = false" />
      </template>
    </Dialog>
  </AppLayout>
</template>


<style scoped>
.users-page {
  display: grid;
  gap: 1rem;
}

.user-cell,
.dialog-user {
  display: flex;

  align-items: center;

  gap:
    0.7rem;
}

.user-avatar,
.dialog-avatar {
  display: grid;

  width:
    2.3rem;

  height:
    2.3rem;

  flex:
    0 0 2.3rem;

  place-items:
    center;

  border-radius:
    999px;

  background:
    rgb(16 185 129 / 0.12);

  color:
    var(--app-primary);

  font-size:
    0.7rem;

  font-weight:
    800;
}

.user-cell strong,
.dialog-user strong {
  display:
    block;

  color:
    var(--app-text);

  font-size:
    0.78rem;
}

.user-cell span,
.dialog-user span {
  display:
    block;

  margin-top:
    0.12rem;

  color:
    var(--app-text-muted);

  font-size:
    0.68rem;
}

.roles-text {
  color:
    var(--app-text-secondary);

  font-size:
    0.75rem;

  line-height:
    1.4;
}

.row-actions {
  display:
    flex;

  flex-wrap:
    nowrap;

  gap:
    0.4rem;
}

.dialog-actions {
  display:
    flex;

  justify-content:
    flex-end;

  gap:
    0.65rem;
}

.password-strength {
  margin-top: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: 0.75rem;
  background: var(--app-surface-2);
}

.password-strength-head {
  display: flex;
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: 0.7rem;
}

.password-meter {
  height: 0.3rem;
  margin-top: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-surface-3);
}

.password-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 180ms ease, background 180ms ease;
}

.password-weak .password-meter span {
  background: #f87171;
}

.password-medium .password-meter span {
  background: #fbbf24;
}

.password-strong .password-meter span {
  background: #34d399;
}

.password-empty .password-meter span {
  background: var(--app-text-muted);
}

.password-weak .password-strength-head strong {
  color: #fca5a5;
}

.password-medium .password-strength-head strong {
  color: #fde68a;
}

.password-strong .password-strength-head strong {
  color: #6ee7b7;
}

.password-rules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.75rem;
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--app-text-muted);
  font-size: 0.68rem;
}

.password-rules li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.password-rules li.valid {
  color: #6ee7b7;
}

@media (max-width: 640px) {
  .password-rules {
    grid-template-columns: 1fr;
  }
}

.temp-pwd-box {
  display: block;
  flex: 1;
  background: var(--app-surface-muted, #f8fafc);
  border: 1px solid var(--app-border, #cbd5e1);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-family: monospace;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--app-primary, #1e40af);
  letter-spacing: 0.05em;
  user-select: all;
  text-align: center;
}

</style>
