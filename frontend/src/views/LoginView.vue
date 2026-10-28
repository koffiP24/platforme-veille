<script setup lang="ts">
import {
  ref,
} from 'vue';

import {
  useRouter,
} from 'vue-router';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';

import {
  useAuthStore,
} from '../stores/auth';

import logoVeille
  from '../assets/logos/logo-veille-microscope.png';


const router =
  useRouter();

const auth =
  useAuthStore();

const email =
  ref('');

const password =
  ref('');

const loading =
  ref(false);

const error =
  ref('');


async function completeLoadingAnimation(
  startedAt:
    number,
) {
  const remaining =
    900
    -
    (
      performance.now()
      -
      startedAt
    );

  if (
    remaining > 0
  ) {
    await new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          remaining,
        ),
    );
  }
}


async function submit() {
  if (
    loading.value
  ) {
    return;
  }

  const animationStartedAt =
    performance.now();

  error.value =
    '';

  loading.value =
    true;

  try {
    await auth.login(
      email.value,
      password.value,
    );

    await completeLoadingAnimation(
      animationStartedAt,
    );

    if (auth.mustChangePassword) { await router.push('/change-password'); } else { await router.push('/'); }
  } catch (
  err:
    any
  ) {
    await completeLoadingAnimation(
      animationStartedAt,
    );

    error.value =
      err.response
        ?.data
        ?.message
      ??
      'Connexion impossible';
  } finally {
    loading.value =
      false;
  }
}
</script>


<template>
  <main class="login-page">

    <Transition name="loading-screen">

      <div v-if="
        loading
      " class="login-loading" role="status" aria-live="polite">

        <div class="loading-logo">

          <span class="loading-ring ring-one" />

          <span class="loading-ring ring-two" />

          <img :src="logoVeille
            " alt="" />

        </div>


        <strong>
          Connexion en cours
        </strong>

        <p>
          Préparation de votre espace de veille…
        </p>


        <div class="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

      </div>

    </Transition>


    <div class="login-shell">

      <section class="login-visual">

        <div class="brand">

          <div class="brand-logo">
            <img :src="logoVeille
              " alt="Logo plateforme de veille" />
          </div>

          <div>
            <span>
              PLATEFORME DE VEILLE
            </span>

            <strong>
              Veille ISO/IEC 17025
            </strong>
          </div>

        </div>


        <div class="visual-content">

          <span class="visual-eyebrow">
            Laboratoire
          </span>

          <h1>
            Centraliser.
            <br />
            Qualifier.
            <br />
            Diffuser.
          </h1>

          <p>
            Une plateforme unique pour suivre
            les informations normatives,
            réglementaires, scientifiques
            et d’accréditation utiles au laboratoire.
          </p>


          <div class="visual-features">

            <span>
              <i class="pi pi-check-circle" />
              Collecte multi-source
            </span>

            <span>
              <i class="pi pi-check-circle" />
              Qualification et validation
            </span>

            <span>
              <i class="pi pi-check-circle" />
              Suivi et diffusion
            </span>

          </div>

        </div>

      </section>


      <section class="login-form-side">

        <div class="login-form-box">

          <div class="mobile-brand">
            <img :src="logoVeille
              " alt="" />

            <strong>
              Veille ISO/IEC 17025
            </strong>
          </div>


          <span class="form-eyebrow">
            Bienvenue
          </span>

          <h2>
            Se connecter
          </h2>

          <p class="form-description">
            Connectez-vous pour accéder
            à votre espace de veille.
          </p>


          <form class="login-form" @submit.prevent="
            submit
          ">

            <Message v-if="
              error
            " severity="error">
              {{ error }}
            </Message>


            <div class="form-field">
              <label>
                Adresse électronique
              </label>

              <InputText v-model="email
                " type="email" class="w-full" placeholder="nom@laboratoire.com" autocomplete="email" required />
            </div>


            <div class="form-field">
              <label>
                Mot de passe
              </label>

              <Password v-model="password
                " :feedback="false
                  " placeholder="Votre mot de passe" autocomplete="current-password" toggle-mask fluid required />
            </div>

            <RouterLink class="forgot-password-link" to="/forgot-password">
              Mot de passe oublié ?
            </RouterLink>


            <Button type="submit" label="Se connecter" icon="pi pi-arrow-right" icon-pos="right" :loading="loading
              " :disabled="loading
                " class="login-submit" />

          </form>


          <p class="login-footer">
            Plateforme de veille pour laboratoire
            ISO/IEC 17025
          </p>

        </div>

      </section>

    </div>

  </main>
</template>


<style scoped>
.login-page {
  display:
    grid;

  min-height:
    100vh;

  padding:
    0 !important;

  background:
    var(--app-bg);
}

.login-shell {
  display:
    grid;

  width:
    100%;

  min-height:
    100vh;

  grid-template-columns:
    minmax(0,
      1.15fr) minmax(26rem,
      0.85fr);
}

.login-visual {
  position:
    relative;

  display:
    flex;

  overflow:
    hidden;

  flex-direction:
    column;

  padding:
    2rem 3rem 3rem;

  background:
    radial-gradient(circle at 30% 30%,
      rgb(16 185 129 / 0.16),
      transparent 24rem),
    linear-gradient(145deg,
      var(--app-bg),
      var(--app-card-end));
}

.login-visual::after {
  position:
    absolute;

  right:
    -10rem;

  bottom:
    -12rem;

  width:
    30rem;

  height:
    30rem;

  border:
    1px solid rgb(52 211 153 / 0.08);

  border-radius:
    999px;

  content:
    "";
}

.brand {
  display:
    flex;

  align-items:
    center;

  gap:
    0.75rem;

  z-index:
    1;
}

.brand-logo {
  display:
    grid;

  width:
    3rem;

  height:
    3rem;

  place-items:
    center;

  border-radius:
    0.9rem;

  background:
    var(--app-surface-2);
}

.brand-logo img {
  width:
    2.5rem;

  height:
    2.5rem;

  object-fit:
    contain;
}

.brand span {
  display:
    block;

  color:
    var(--app-primary);

  font-size:
    0.58rem;

  font-weight:
    800;

  letter-spacing:
    0.12em;
}

.brand strong {
  display:
    block;

  margin-top:
    0.15rem;

  color:
    var(--app-text);

  font-size:
    0.85rem;
}

.visual-content {
  display:
    flex;

  max-width:
    38rem;

  flex:
    1;

  flex-direction:
    column;

  justify-content:
    center;

  z-index:
    1;
}

.visual-eyebrow,
.form-eyebrow {
  color:
    var(--app-primary);

  font-size:
    0.65rem;

  font-weight:
    800;

  letter-spacing:
    0.14em;

  text-transform:
    uppercase;
}

.visual-content h1 {
  margin:
    0.8rem 0;

  color:
    var(--app-text);

  font-size:
    clamp(2.6rem,
      6vw,
      4.8rem);

  font-weight:
    820;

  line-height:
    0.98;

  letter-spacing:
    -0.04em;
}

.visual-content>p {
  max-width:
    33rem;

  color:
    var(--app-text-muted);

  font-size:
    0.92rem;

  line-height:
    1.75;
}

.visual-features {
  display:
    grid;

  gap:
    0.55rem;

  margin-top:
    1.3rem;
}

.visual-features span {
  display:
    flex;

  align-items:
    center;

  gap:
    0.55rem;

  color:
    var(--app-text-secondary);

  font-size:
    0.76rem;
}

.visual-features i {
  color:
    var(--app-primary);
}

.login-form-side {
  display:
    grid;

  place-items:
    center;

  padding:
    2rem;

  background:
    var(--app-surface);
}

.login-form-box {
  width:
    min(100%,
      25rem);
}

.login-form-box h2 {
  margin:
    0.5rem 0 0;

  color:
    var(--app-text);

  font-size:
    2rem;

  font-weight:
    800;
}

.form-description {
  margin:
    0.4rem 0 1.6rem;

  color:
    var(--app-text-muted);

  font-size:
    0.8rem;
}

.login-form {
  display:
    grid;

  gap:
    1rem;
}

.form-field {
  display:
    grid;

  gap:
    0.45rem;
}

.form-field label {
  color:
    var(--app-text-secondary);

  font-size:
    0.72rem;

  font-weight:
    650;
}

.login-submit {
  width:
    100%;

  margin-top:
    0.3rem;
}

.forgot-password-link {
  color: var(--app-primary);
  font-size: 0.78rem;
  text-align: right;
  text-decoration: none;
}

.forgot-password-link:hover {
  text-decoration: underline;
}

.login-footer {
  margin-top:
    1.5rem;

  color:
    var(--app-text-muted);

  font-size:
    0.65rem;

  text-align:
    center;
}

.mobile-brand {
  display:
    none;
}

.login-loading {
  position:
    fixed;

  inset:
    0;

  z-index:
    9999;

  display:
    flex;

  flex-direction:
    column;

  align-items:
    center;

  justify-content:
    center;

  background:
    color-mix(in srgb, var(--app-bg) 97%, transparent);

  backdrop-filter:
    blur(8px);
}

.loading-logo {
  position:
    relative;

  display:
    grid;

  width:
    9rem;

  height:
    9rem;

  place-items:
    center;

  margin-bottom:
    1.2rem;
}

.loading-logo img {
  position:
    relative;

  z-index:
    2;

  width:
    6rem;

  height:
    6rem;

  object-fit:
    contain;

  animation:
    logo-breathe 1.4s ease-in-out infinite;
}

.loading-ring {
  position:
    absolute;

  border:
    2px solid rgb(52 211 153 / 0.6);

  border-radius:
    999px;

  opacity:
    0;

  animation:
    radar-wave 1.8s ease-out infinite;
}

.ring-one {
  inset:
    1.2rem;
}

.ring-two {
  inset:
    0;

  animation-delay:
    0.6s;
}

.login-loading strong {
  color:
    var(--app-text);

  font-size:
    1.15rem;
}

.login-loading p {
  margin-top:
    0.4rem;

  color:
    var(--app-text-muted);

  font-size:
    0.76rem;
}

.loading-dots {
  display:
    flex;

  gap:
    0.4rem;

  margin-top:
    1rem;
}

.loading-dots span {
  width:
    0.42rem;

  height:
    0.42rem;

  border-radius:
    999px;

  background:
    var(--app-primary);

  animation:
    dot-bounce 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay:
    0.15s;
}

.loading-dots span:nth-child(3) {
  animation-delay:
    0.3s;
}

.loading-screen-enter-active,
.loading-screen-leave-active {
  transition:
    opacity 180ms ease;
}

.loading-screen-enter-from,
.loading-screen-leave-to {
  opacity:
    0;
}

@keyframes radar-wave {
  0% {
    opacity:
      0.8;

    transform:
      scale(0.65);
  }

  100% {
    opacity:
      0;

    transform:
      scale(1.15);
  }
}

@keyframes logo-breathe {

  0%,
  100% {
    transform:
      scale(0.96);
  }

  50% {
    transform:
      scale(1.04);
  }
}

@keyframes dot-bounce {

  0%,
  60%,
  100% {
    opacity:
      0.35;

    transform:
      translateY(0);
  }

  30% {
    opacity:
      1;

    transform:
      translateY(-0.35rem);
  }
}

@media (max-width: 850px) {
  .login-shell {
    grid-template-columns:
      1fr;
  }

  .login-visual {
    display:
      none;
  }

  .login-form-side {
    min-height:
      100vh;
  }

  .mobile-brand {
    display:
      flex;

    align-items:
      center;

    gap:
      0.7rem;

    margin-bottom:
      2rem;
  }

  .mobile-brand img {
    width:
      2.8rem;

    height:
      2.8rem;

    object-fit:
      contain;
  }

  .mobile-brand strong {
    color:
      var(--app-text);

    font-size:
      0.85rem;
  }
}

@media (prefers-reduced-motion: reduce) {

  .loading-logo img,
  .loading-ring,
  .loading-dots span {
    animation:
      none;
  }
}
</style>

