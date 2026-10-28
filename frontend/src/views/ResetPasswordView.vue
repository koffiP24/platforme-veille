<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import Button from 'primevue/button';
import Password from 'primevue/password';
import Message from 'primevue/message';
import api from '../services/api';
import logo from '../assets/logos/logo-veille-microscope.png';

const route = useRoute();
const token = typeof route.query.token === 'string' ? route.query.token : '';
if (token) window.history.replaceState(window.history.state, '', route.path);
const password = ref('');
const confirmation = ref('');
const loading = ref(false);
const completed = ref(false);
const error = ref('');
const passwordRules = computed(() => {
  const value = password.value;
  return [
    { label: '12 caractères minimum', valid: value.length >= 12 },
    { label: 'Une lettre minuscule', valid: /[a-z]/.test(value) },
    { label: 'Une lettre majuscule', valid: /[A-Z]/.test(value) },
    { label: 'Un chiffre', valid: /\d/.test(value) },
    { label: 'Un caractère spécial', valid: /[^A-Za-z0-9]/.test(value) },
    { label: '72 caractères maximum', valid: value.length > 0 && value.length <= 72 },
  ];
});
const validPassword = computed(() => passwordRules.value.every((rule) => rule.valid));
const passwordsMatch = computed(() => password.value === confirmation.value);

async function submit() {
  if (loading.value || !token) return;
  error.value = '';
  if (!validPassword.value) {
    error.value = 'Utilisez au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial.';
    return;
  }
  if (password.value !== confirmation.value) {
    error.value = 'Les mots de passe ne correspondent pas.';
    return;
  }
  loading.value = true;
  try {
    await api.post('/auth/reset-password', { token, newPassword: password.value });
    completed.value = true;
    password.value = '';
    confirmation.value = '';
  } catch (cause: any) {
    error.value = cause.response?.data?.message ?? 'Lien invalide ou expiré. Demandez un nouveau lien.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="recovery-page">
    <section class="recovery-card">
      <img class="recovery-logo" :src="logo" alt="Logo plateforme de veille" />
      <h1>Nouveau mot de passe</h1>
      <Message v-if="!token" severity="error">Lien de réinitialisation manquant. Demandez un nouveau lien.</Message>
      <Message v-if="completed" severity="success">Mot de passe modifié. Vous pouvez vous connecter.</Message>
      <Message v-if="error" severity="error">{{ error }}</Message>
      <form v-if="token && !completed" @submit.prevent="submit">
        <label for="new-password">Nouveau mot de passe</label>
        <Password id="new-password" v-model="password" autocomplete="new-password" :feedback="false" toggle-mask fluid required />
        <div class="password-checklist">
          <span class="checklist-title">Critères de sécurité :</span>
          <ul>
            <li v-for="rule in passwordRules" :key="rule.label" :class="{ met: rule.valid }">
              <i :class="rule.valid ? 'pi pi-check' : 'pi pi-circle'" />
              {{ rule.label }}
            </li>
          </ul>
        </div>
        <label for="confirm-password">Confirmer le mot de passe</label>
        <Password id="confirm-password" v-model="confirmation" autocomplete="new-password" :feedback="false" toggle-mask fluid required />
        <small v-if="confirmation && !passwordsMatch" class="text-danger">Les mots de passe ne correspondent pas.</small>
        <Button type="submit" label="Enregistrer le mot de passe" :loading="loading" :disabled="loading || !validPassword || !passwordsMatch" fluid />
      </form>
      <RouterLink :to="token ? '/login' : '/forgot-password'">{{ token ? 'Retour à la connexion' : 'Demander un nouveau lien' }}</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.recovery-page { min-height: 100vh; display: grid; place-items: center; padding: 1.25rem; background: var(--app-bg); }
.recovery-card { width: min(100%, 28rem); display: grid; gap: 1rem; padding: 2rem; border: 1px solid var(--app-border-strong); border-radius: 1rem; background: var(--app-surface); box-shadow: var(--app-shadow); }
.recovery-logo { width: 3.2rem; height: 3.2rem; object-fit: contain; }
h1 { margin: 0; color: var(--app-text); font-size: 1.5rem; }
form { display: grid; gap: .75rem; }
label { color: var(--app-text-secondary); font-size: .82rem; }
.password-checklist { display: grid; gap: .4rem; padding: .75rem 1rem; border: 1px solid var(--app-border); border-radius: .5rem; background: var(--app-surface-muted); font-size: .8rem; }
.checklist-title { color: var(--app-text-secondary); font-weight: 600; }
.password-checklist ul { display: grid; gap: .25rem; margin: 0; padding: 0; list-style: none; }
.password-checklist li { display: flex; align-items: center; gap: .5rem; color: var(--app-text-muted); }
.password-checklist li.met { color: #16a34a; font-weight: 500; }
.text-danger { color: #dc2626; font-size: .78rem; }
a { color: var(--app-primary); font-size: .82rem; text-decoration: none; }
a:hover { text-decoration: underline; }
</style>
