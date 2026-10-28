<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import api from '../services/api';
import logo from '../assets/logos/logo-veille-microscope.png';

const email = ref('');
const loading = ref(false);
const sent = ref(false);
const accountMissing = ref(false);
const error = ref('');

async function submit() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  sent.value = false;
  accountMissing.value = false;
  try {
    const response = await api.post('/auth/forgot-password', { email: email.value.trim() });
    accountMissing.value = response.data.accountExists === false;
    sent.value = response.data.accountExists === true;
  } catch (cause: any) {
    error.value = cause.response?.data?.message ?? 'Demande impossible. Réessayez plus tard.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="recovery-page">
    <section class="recovery-card">
      <img class="recovery-logo" :src="logo" alt="Logo plateforme de veille" />
      <h1>Mot de passe oublié</h1>
      <p>Indiquez votre adresse électronique. Si elle est associée à un compte actif, vous recevrez un lien valable 15
        minutes.</p>
      <Message v-if="sent" severity="success">Un lien de réinitialisation a été envoyé. Il est valable 15 minutes.</Message>
      <Message v-if="error" severity="error">{{ error }}</Message>
      <Message v-if="accountMissing" severity="error">Aucun compte actif n’existe avec cette adresse électronique.</Message>
      <form v-if="!sent" @submit.prevent="submit">
        <label for="recovery-email">Adresse électronique</label>
        <InputText id="recovery-email" v-model="email" type="email" autocomplete="email" placeholder="nom@gmail.com"
          required fluid />
        <Button type="submit" label="Envoyer le lien" :loading="loading" :disabled="loading" fluid />
      </form>
      <RouterLink :to="{ name: 'login', query: { recovery: '1' } }">Retour à la connexion</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.recovery-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: var(--app-bg);
}

.recovery-card {
  width: min(100%, 27rem);
  display: grid;
  gap: 1rem;
  padding: 2rem;
  border: 1px solid var(--app-border-strong);
  border-radius: 1rem;
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.recovery-logo {
  width: 3.2rem;
  height: 3.2rem;
  object-fit: contain;
}

h1 {
  margin: 0;
  color: var(--app-text);
  font-size: 1.5rem;
}

p {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: .88rem;
  line-height: 1.6;
}

form {
  display: grid;
  gap: .75rem;
}

label {
  color: var(--app-text-secondary);
  font-size: .82rem;
}

a {
  color: var(--app-primary);
  font-size: .82rem;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
