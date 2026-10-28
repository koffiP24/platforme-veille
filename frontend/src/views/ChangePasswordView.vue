<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Password from 'primevue/password';
import Message from 'primevue/message';
import { useAuthStore } from '../stores/auth';
import logo from '../assets/logos/logo-veille-microscope.png';

const router = useRouter();
const auth = useAuthStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmation = ref('');
const loading = ref(false);
const error = ref('');

const passwordRules = computed(() => {
  const value = newPassword.value;
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

const passwordsMatch = computed(
  () => newPassword.value === confirmation.value,
);

async function submit() {
  if (loading.value) return;
  error.value = '';

  if (!currentPassword.value) {
    error.value = 'Veuillez saisir votre mot de passe temporaire actuel.';
    return;
  }

  if (!passwordValid.value) {
    error.value = 'Le nouveau mot de passe ne respecte pas toutes les règles de sécurité.';
    return;
  }

  if (!passwordsMatch.value) {
    error.value = 'La confirmation ne correspond pas au nouveau mot de passe.';
    return;
  }

  if (currentPassword.value === newPassword.value) {
    error.value = 'Le nouveau mot de passe doit être différent du mot de passe temporaire.';
    return;
  }

  loading.value = true;
  try {
    await auth.changePassword(currentPassword.value, newPassword.value);
    await router.replace('/');
  } catch (cause: any) {
    error.value =
      cause.response?.data?.message ??
      'Erreur lors du changement de mot de passe. Veuillez vérifier le mot de passe actuel.';
  } finally {
    loading.value = false;
  }
}

async function logout() {
  await auth.logout();
  await router.replace('/login');
}
</script>

<template>
  <main class="change-password-page">
    <section class="change-password-card">
      <div class="header-section">
        <img class="header-logo" :src="logo" alt="Logo plateforme de veille" />
        <div class="header-text">
          <h1>Changement obligatoire de mot de passe</h1>
          <p>
            Votre compte utilise actuellement un mot de passe temporaire. Vous devez obligatoirement
            définir un nouveau mot de passe personnel avant d’accéder à l’application.
          </p>
        </div>
      </div>

      <Message v-if="error" severity="error">{{ error }}</Message>

      <form @submit.prevent="submit">
        <label for="current-password">Mot de passe actuel (temporaire)</label>
        <Password
          id="current-password"
          v-model="currentPassword"
          autocomplete="current-password"
          :feedback="false"
          toggle-mask
          fluid
          required
        />

        <label for="new-password">Nouveau mot de passe personnel</label>
        <Password
          id="new-password"
          v-model="newPassword"
          autocomplete="new-password"
          :feedback="false"
          toggle-mask
          fluid
          required
        />

        <div class="password-checklist">
          <span class="checklist-title">Critères de sécurité :</span>
          <ul>
            <li
              v-for="rule in passwordRules"
              :key="rule.label"
              :class="{ met: rule.valid }"
            >
              <i :class="rule.valid ? 'pi pi-check' : 'pi pi-circle'" />
              {{ rule.label }}
            </li>
          </ul>
        </div>

        <label for="confirm-password">Confirmer le nouveau mot de passe</label>
        <Password
          id="confirm-password"
          v-model="confirmation"
          autocomplete="new-password"
          :feedback="false"
          toggle-mask
          fluid
          required
        />
        <small v-if="confirmation && !passwordsMatch" class="text-danger">
          Les mots de passe ne correspondent pas.
        </small>

        <div class="actions">
          <Button
            type="submit"
            label="Enregistrer le nouveau mot de passe"
            icon="pi pi-check"
            :loading="loading"
            :disabled="loading || !passwordValid || !passwordsMatch || !currentPassword"
            fluid
          />
        </div>
      </form>

      <div class="footer-action">
        <button type="button" class="logout-link" @click="logout">
          <i class="pi pi-sign-out mr-1" /> Se déconnecter
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.change-password-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--app-bg, #f8fafc);
}

.change-password-card {
  width: min(100%, 32rem);
  display: grid;
  gap: 1.25rem;
  padding: 2.25rem;
  border: 1px solid var(--app-border-strong, #e2e8f0);
  border-radius: 1.25rem;
  background: var(--app-surface, #ffffff);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
}

.header-section {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.header-logo {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
  flex-shrink: 0;
}

.header-text h1 {
  margin: 0;
  color: var(--app-text, #0f172a);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
}

.header-text p {
  margin: 0.5rem 0 0 0;
  color: var(--app-text-secondary, #64748b);
  font-size: 0.85rem;
  line-height: 1.5;
}

form {
  display: grid;
  gap: 0.75rem;
}

label {
  color: var(--app-text, #334155);
  font-size: 0.82rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.password-checklist {
  background: var(--app-surface-muted, #f8fafc);
  border: 1px solid var(--app-border, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
}

.checklist-title {
  display: block;
  font-weight: 600;
  color: var(--app-text-secondary, #64748b);
  margin-bottom: 0.4rem;
}

.password-checklist ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.25rem;
}

.password-checklist li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--app-text-muted, #94a3b8);
}

.password-checklist li.met {
  color: #16a34a;
  font-weight: 500;
}

.text-danger {
  color: #dc2626;
  font-size: 0.78rem;
}

.actions {
  margin-top: 0.75rem;
}

.footer-action {
  text-align: center;
  border-top: 1px solid var(--app-border, #f1f5f9);
  padding-top: 1rem;
}

.logout-link {
  background: none;
  border: none;
  color: var(--app-text-secondary, #64748b);
  font-size: 0.82rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.logout-link:hover {
  color: #dc2626;
  text-decoration: underline;
}
</style>
