<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  nextTick,
  ref,
  watch,
} from 'vue';

import {
  useRoute,
  useRouter,
} from 'vue-router';

import Button from 'primevue/button';

import BarsIcon from '@primeicons/vue/bars';
import BellIcon from '@primeicons/vue/bell';
import BookIcon from '@primeicons/vue/book';
import ChartBarIcon from '@primeicons/vue/chart-bar';
import CheckSquareIcon from '@primeicons/vue/check-square';
import HistoryIcon from '@primeicons/vue/history';
import HomeIcon from '@primeicons/vue/home';
import ServerIcon from '@primeicons/vue/server';
import SignOutIcon from '@primeicons/vue/sign-out';
import SitemapIcon from '@primeicons/vue/sitemap';
import StarIcon from '@primeicons/vue/star';
import UsersIcon from '@primeicons/vue/users';

import { labelFr } from '../i18n/labels';
import { getFavorites } from '../services/favorites.service';
import { getNotifications } from '../services/notifications.service';
import { getMyPendingActionCount } from '../services/actions.service';
import NotificationDrawer from '../components/notifications/NotificationDrawer.vue';
import { useAuthStore } from '../stores/auth';
import logoVeille from '../assets/logos/logo-veille-microscope.png';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const mobileMenuOpen = ref(false);
const sidebarMenu = ref<HTMLElement | null>(null);
const SIDEBAR_SCROLL_KEY = 'app-sidebar-scroll-top';
let restoringSidebarScroll = false;

function saveSidebarScroll(event: Event) {
  if (restoringSidebarScroll) {
    return;
  }

  try {
    sessionStorage.setItem(
      SIDEBAR_SCROLL_KEY,
      String((event.currentTarget as HTMLElement).scrollTop),
    );
  } catch {
    // Navigation remains usable when browser storage is unavailable.
  }
}

function rememberSidebarScroll() {
  try {
    if (sidebarMenu.value) {
      sessionStorage.setItem(
        SIDEBAR_SCROLL_KEY,
        String(sidebarMenu.value.scrollTop),
      );
    }
  } catch {
    // Navigation remains usable when browser storage is unavailable.
  }
}

async function restoreSidebarScroll() {
  await nextTick();
  window.requestAnimationFrame(() => {
    try {
      const savedPosition = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY));
      if (Number.isFinite(savedPosition) && sidebarMenu.value) {
        restoringSidebarScroll = true;
        sidebarMenu.value.scrollTop = savedPosition;
        window.requestAnimationFrame(() => {
          restoringSidebarScroll = false;
        });
      }
    } catch {
      restoringSidebarScroll = false;
      // Ignore unavailable browser storage.
    }
  });
}

watch(
  () => route.fullPath,
  () => {
    void restoreSidebarScroll();
  },
);

const hasFavorites = ref(false);
const unreadNotifications = ref(0);
const notificationDrawerOpen = ref(false);
const pendingActions = ref(0);

watch(hasFavorites, () => {
  void restoreSidebarScroll();
});

let notificationRefreshTimer:
  ReturnType<typeof setInterval> | undefined;

let actionRefreshTimer:
  ReturnType<typeof setInterval> | undefined;

let desktopViewportQuery:
  MediaQueryList | undefined;

let notificationRefreshing = false;
let actionRefreshing = false;

const applicationRoles = [
  'ADMIN',
  'RESPONSABLE_VEILLE',
  'REFERENT_LABORATOIRE',
  'LECTEUR',
  'OPERATEUR_VEILLE',
] as const;

const displayedRoles = computed(() => {
  const roles = auth.user?.roles ?? [];

  return applicationRoles.every(
    (role) =>
      roles.includes(role),
  )
    ? 'Tous les rôles'
    : roles
      .map(labelFr)
      .join(', ');
});

const canViewWatchItems = computed(() =>
  [
    'ADMIN',
    'RESPONSABLE_VEILLE',
    'REFERENT_LABORATOIRE',
    'OPERATEUR_VEILLE',
    'LECTEUR',
  ].some(
    (role) =>
      auth.user?.roles.includes(
        role,
      ),
  ),
);

const canSeeActions = computed(() => {
  const roles =
    auth.user?.roles ?? [];

  return (
    roles.includes('ADMIN')
    ||
    roles.includes(
      'RESPONSABLE_VEILLE',
    )
    ||
    roles.includes(
      'REFERENT_LABORATOIRE',
    )
  );
});

const canSeeReports = computed(() => {
  const roles =
    auth.user?.roles ?? [];

  return (
    roles.includes('ADMIN')
    ||
    roles.includes(
      'RESPONSABLE_VEILLE',
    )
  );
});

const initials = computed(() =>
  (
    `${auth.user?.firstName?.[0] ?? ''}${auth.user?.lastName?.[0] ?? ''}`
  ).toUpperCase()
  ||
  'U',
);

const pageName = computed(() => {
  const names:
    Record<string, string> = {
    dashboard:
      'Tableau de bord',

    'watch-items':
      'Éléments de veille',

    'watch-item-detail':
      'Détail de la veille',

    'watch-item-qualification':
      'Qualification',

    actions:
      'Actions',

    reports:
      'Rapports',

    subscriptions:
      'Mes abonnements',

    notifications:
      'Notifications',

    taxonomy:
      'Taxonomie',

    audit:
      'Journal d’audit',

    health:
      'Administration des sources',

    users:
      'Utilisateurs',
  };

  return (
    names[
    String(route.name ?? '')
    ]
    ??
    'Veille ISO/IEC 17025'
  );
});

async function logout() {
  try {
    await auth.logout();
  } finally {
    await router.push(
      '/login',
    );
  }
}

function closeMobileMenu() {
  mobileMenuOpen.value =
    false;
}

function closeMenuWhenDesktop(event: MediaQueryListEvent) {
  if (event.matches) closeMobileMenu();
}

async function refreshFavoritesVisibility() {
  try {
    const response =
      await getFavorites();

    hasFavorites.value =
      Array.isArray(
        response.data,
      )
      &&
      response.data.length > 0;
  } catch {
    hasFavorites.value =
      false;
  }
}

async function refreshNotificationCount() {
  if (
    document.visibilityState !==
    'visible'
    ||
    notificationRefreshing
    ||
    route.name ===
    'notifications'
  ) {
    return;
  }

  notificationRefreshing =
    true;

  try {
    const response =
      await getNotifications();

    unreadNotifications.value =
      Array.isArray(
        response.data,
      )
        ? response.data.filter(
          (
            notification: {
              readAt?:
              string | null;
            },
          ) =>
            !notification.readAt,
        ).length
        : 0;
  } catch {
    unreadNotifications.value =
      0;
  } finally {
    notificationRefreshing =
      false;
  }
}

async function refreshActionCount() {
  if (
    document.visibilityState !==
    'visible'
    ||
    actionRefreshing
    ||
    !canSeeActions.value
  ) {
    return;
  }

  actionRefreshing =
    true;

  try {
    const response =
      await getMyPendingActionCount();

    pendingActions.value =
      Number(
        response.data?.count,
      )
      ||
      0;
  } catch {
    pendingActions.value =
      0;
  } finally {
    actionRefreshing =
      false;
  }
}

function refreshWhenVisible() {
  if (
    document.visibilityState ===
    'visible'
  ) {
    void refreshNotificationCount();
    void refreshActionCount();
  }
}

function updateFavoritesVisibility(
  event: Event,
) {
  const count =
    (
      event as
      CustomEvent<number>
    ).detail;

  if (
    typeof count ===
    'number'
  ) {
    hasFavorites.value =
      count > 0;

    return;
  }

  void refreshFavoritesVisibility();
}

function updateNotificationCount(
  event: Event,
) {
  const count =
    (
      event as
      CustomEvent<number>
    ).detail;

  if (
    typeof count ===
    'number'
  ) {
    unreadNotifications.value =
      count;

    return;
  }

  void refreshNotificationCount();
}

onMounted(() => {
  void restoreSidebarScroll();

  desktopViewportQuery = window.matchMedia('(min-width: 768px)');
  desktopViewportQuery.addEventListener('change', closeMenuWhenDesktop);

  window.addEventListener(
    'favorites-changed',
    updateFavoritesVisibility,
  );

  window.addEventListener(
    'notifications-changed',
    updateNotificationCount,
  );

  window.addEventListener(
    'actions-changed',
    refreshActionCount,
  );

  document.addEventListener(
    'visibilitychange',
    refreshWhenVisible,
  );

  void refreshFavoritesVisibility();
  void refreshNotificationCount();
  void refreshActionCount();

  notificationRefreshTimer =
    setInterval(
      () =>
        void refreshNotificationCount(),
      15000,
    );

  actionRefreshTimer =
    setInterval(
      () =>
        void refreshActionCount(),
      15000,
    );
});

onBeforeUnmount(() => {
  desktopViewportQuery?.removeEventListener('change', closeMenuWhenDesktop);

  window.removeEventListener(
    'favorites-changed',
    updateFavoritesVisibility,
  );

  window.removeEventListener(
    'notifications-changed',
    updateNotificationCount,
  );

  window.removeEventListener(
    'actions-changed',
    refreshActionCount,
  );

  document.removeEventListener(
    'visibilitychange',
    refreshWhenVisible,
  );

  if (
    notificationRefreshTimer
  ) {
    clearInterval(
      notificationRefreshTimer,
    );
  }

  if (
    actionRefreshTimer
  ) {
    clearInterval(
      actionRefreshTimer,
    );
  }
});
</script>

<template>
  <div class="app-shell" :class="{ 'navigation-expanded': mobileMenuOpen }">


    <aside id="module-navigation" class="app-sidebar" :class="{
      'app-sidebar-open':
        mobileMenuOpen,
    }">


      <RouterLink to="/" class="sidebar-brand" @click="
        closeMobileMenu
      ">
        <span class="brand-symbol">
          <img :src="logoVeille" alt="Veille" />
        </span>

        <span class="brand-name">
          Veille
        </span>
      </RouterLink>



      <nav ref="sidebarMenu" class="sidebar-menu" @scroll.passive="saveSidebarScroll" @click.capture="rememberSidebarScroll">

        <RouterLink to="/" class="sidebar-item" exact-active-class="sidebar-item-active" @click="
          closeMobileMenu
        ">
          <HomeIcon size="1.1rem" />

          <span>
            Tableau
          </span>
        </RouterLink>


        <RouterLink v-if="
          canViewWatchItems
        " to="/watch-items" class="sidebar-item" :class="{
            'sidebar-item-active':
              route.path ===
              '/watch-items'
              &&
              route.query
                .favorites !==
              '1',
          }" @click="
            closeMobileMenu
          ">
          <BookIcon size="1.1rem" />

          <span>
            Veille
          </span>
        </RouterLink>


        <RouterLink v-if="
          canViewWatchItems
          &&
          hasFavorites
        " :to="{
            path:
              '/watch-items',

            query: {
              favorites:
                '1',
            },
          }" class="sidebar-item" :class="{
            'sidebar-item-active':
              route.path ===
              '/watch-items'
              &&
              route.query
                .favorites ===
              '1',
          }" @click="
            closeMobileMenu
          ">
          <StarIcon size="1.1rem" />

          <span>
            Favoris
          </span>
        </RouterLink>


        <RouterLink v-if="
          canSeeActions
        " to="/actions" class="sidebar-item" active-class="sidebar-item-active" @click="
            closeMobileMenu
          ">
          <CheckSquareIcon size="1.1rem" />

          <span>
            Actions
          </span>

          <span v-if="
            pendingActions > 0
          " class="sidebar-counter">
            {{
              pendingActions > 99
                ? '99+'
                : pendingActions
            }}
          </span>
        </RouterLink>


        <RouterLink v-if="
          canSeeReports
        " to="/reports" class="sidebar-item" active-class="sidebar-item-active" @click="
            closeMobileMenu
          ">
          <ChartBarIcon size="1.1rem" />

          <span>
            Rapports
          </span>
        </RouterLink>


        <RouterLink to="/subscriptions" class="sidebar-item" active-class="sidebar-item-active" @click="
          closeMobileMenu
        ">
          <BellIcon size="1.1rem" />

          <span>
            Alertes
          </span>
        </RouterLink>


        <div v-if="
          canSeeReports
          ||
          auth.isAdmin
        " class="sidebar-divider" />


        <RouterLink v-if="
          auth.isAdmin
        " to="/taxonomy" class="sidebar-item" active-class="sidebar-item-active" @click="
            closeMobileMenu
          ">
          <SitemapIcon size="1.1rem" />

          <span>
            Taxonomie
          </span>
        </RouterLink>


        <RouterLink v-if="
          auth.isAdmin
        " to="/users" class="sidebar-item" active-class="sidebar-item-active" @click="
            closeMobileMenu
          ">
          <UsersIcon size="1.1rem" />

          <span>
            Utilisateurs
          </span>
        </RouterLink>


        <RouterLink v-if="
          canSeeReports
        " to="/audit" class="sidebar-item" active-class="sidebar-item-active" @click="
            closeMobileMenu
          ">
          <HistoryIcon size="1.1rem" />

          <span>
            Audit
          </span>
        </RouterLink>


        <RouterLink v-if="
          canSeeReports
        " to="/health" class="sidebar-item" active-class="sidebar-item-active"
          title="Administration et santé des sources" @click="
            closeMobileMenu
          ">
          <ServerIcon size="1.1rem" />

          <span>
            Sources
          </span>
        </RouterLink>

      </nav>



      <div class="sidebar-footer">
        <Button text severity="secondary" aria-label="Déconnexion" title="Déconnexion" @click="
          logout
        ">
          <template #icon>
            <SignOutIcon size="1rem" />
          </template>
        </Button>
      </div>

    </aside>



    <button v-if="
      mobileMenuOpen
    " type="button" class="sidebar-overlay" aria-label="Fermer le menu" @click="
        closeMobileMenu
      " />



    <div class="app-body">


      <header class="topbar">

        <div class="topbar-left">
          <button type="button" class="mobile-menu" :aria-label="mobileMenuOpen ? 'Replier le menu' : 'Ouvrir le menu des modules'" :aria-expanded="mobileMenuOpen" aria-controls="module-navigation" @click="
            mobileMenuOpen =
            !mobileMenuOpen
            ">
            <BarsIcon size="1rem" />
          </button>

          <div>
            <span class="topbar-eyebrow">
              VEILLE
            </span>

            <strong class="topbar-title">
              {{ pageName }}
            </strong>
          </div>
        </div>


        <div class="topbar-right">

          <button type="button" class="notification-button" :class="{
            'notification-button-active': notificationDrawerOpen,
          }" title="Notifications" aria-label="Ouvrir les notifications" :aria-expanded="notificationDrawerOpen" @click="notificationDrawerOpen = !notificationDrawerOpen">
            <BellIcon size="1.05rem" />

            <span v-if="
              unreadNotifications > 0
            " class="notification-count">
              {{
                unreadNotifications > 99
                  ? '99+'
                  : unreadNotifications
              }}
            </span>
          </button>


          <div class="topbar-separator" />


          <div class="profile">
            <div class="profile-avatar">
              {{ initials }}
            </div>

            <div class="profile-copy">
              <strong>
                {{
                  auth.user
                    ?.firstName
                }}

                {{
                  auth.user
                    ?.lastName
                }}
              </strong>

              <span>
                {{ displayedRoles }}
              </span>
            </div>
          </div>

        </div>

      </header>



      <main class="app-main">
        <slot />
      </main>

      <NotificationDrawer v-if="notificationDrawerOpen" @close="notificationDrawerOpen = false" />

    </div>

  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--app-bg);
}

.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 60;

  display: flex;
  width: 5.35rem;
  flex-direction: column;

  border-right:
    1px solid var(--app-border);

  background:
    linear-gradient(180deg,
      var(--app-sidebar-start),
      var(--app-sidebar-end));

  box-shadow:
    14px 0 35px rgb(0 0 0 / 0.12);
}

.sidebar-brand {
  display: flex;
  height: 5rem;
  align-items: center;
  justify-content: center;

  color: white;
  text-decoration: none;
}

.brand-symbol {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;

  place-items: center;

  border-radius: 0.9rem;

  background:
    linear-gradient(135deg,
      #34d399,
      #2dd4bf);

  color: #052e2b;

  font-weight: 900;

  box-shadow:
    0 10px 25px rgb(16 185 129 / 0.2);
}

.brand-symbol img {
  width: 2.1rem;
  height: 2.1rem;
  object-fit: contain;
  border-radius: 0.68rem;
}

.brand-name {
  display: none;
}

.sidebar-menu {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;

  gap: 0.25rem;

  overflow-y: auto;

  padding:
    0.7rem 0.5rem;
}

.sidebar-item {
  position: relative;

  display: flex;
  min-height: 4rem;

  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 0.35rem;

  border-radius: 0.8rem;

  color: var(--app-text-muted);

  font-size: 0.62rem;
  font-weight: 650;

  text-decoration: none;

  transition:
    150ms ease;
}

.sidebar-item:hover {
  background:
    var(--app-surface-3);

  color: var(--app-text);
}

.sidebar-item-active {
  background:
    linear-gradient(135deg,
      rgb(16 185 129 / 0.18),
      rgb(20 184 166 / 0.06));

  color: var(--app-primary);

  box-shadow:
    inset 3px 0 #34d399;
}

.sidebar-counter {
  position: absolute;

  top: 0.35rem;
  right: 0.35rem;

  min-width: 1.15rem;

  padding:
    0.14rem 0.3rem;

  border-radius: 999px;

  background: #f59e0b;
  color: white;

  font-size: 0.56rem;
  font-weight: 800;

  text-align: center;
}

.sidebar-divider {
  height: 1px;

  margin:
    0.45rem 0.75rem;

  background:
    var(--app-border);
}

.sidebar-footer {
  display: flex;
  justify-content: center;

  padding:
    0.8rem 0.5rem;
}

.app-body {
  min-width: 0;
  min-height: 100vh;

  margin-left:
    5.35rem;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;

  display: flex;
  min-height: 4.8rem;

  align-items: center;
  justify-content: space-between;

  padding:
    0 1.75rem;

  border-bottom:
    1px solid var(--app-border);

  background:
    var(--app-topbar);

  backdrop-filter:
    blur(18px);
}

.topbar-left,
.topbar-right,
.profile {
  display: flex;
  align-items: center;
}

.topbar-left {
  gap: 0.75rem;
}

.topbar-right {
  gap: 0.75rem;
}

.topbar-eyebrow {
  display: block;

  color: var(--app-primary);

  font-size: 0.61rem;
  font-weight: 800;

  letter-spacing:
    0.13em;
}

.topbar-title {
  display: block;

  margin-top:
    0.15rem;

  color:
    var(--app-text);

  font-size:
    0.86rem;
}

.notification-button {
  position: relative;

  display: grid;

  width: 2.45rem;
  height: 2.45rem;

  place-items: center;

  border: 0;
  background: transparent;
  cursor: pointer;

  border-radius: 0.75rem;

  color: var(--app-text-muted);
}

.notification-button:hover,
.notification-button-active {
  background:
    var(--app-surface-2);

  color:
    var(--app-primary);
}

.notification-count {
  position: absolute;

  top: -0.2rem;
  right: -0.2rem;

  display: grid;

  min-width: 1rem;
  height: 1rem;

  place-items: center;

  padding:
    0 0.2rem;

  border:
    2px solid var(--app-bg);

  border-radius:
    999px;

  background:
    #ef4444;

  color:
    white;

  font-size:
    0.52rem;

  font-weight:
    800;
}

.topbar-separator {
  width: 1px;
  height: 2rem;

  background:
    var(--app-border);
}

.profile {
  min-width: 0;

  gap:
    0.7rem;
}

.profile-avatar {
  display: grid;

  width: 2.55rem;
  height: 2.55rem;

  flex: 0 0 2.55rem;

  place-items: center;

  border:
    1px solid rgb(52 211 153 / 0.2);

  border-radius:
    999px;

  background:
    linear-gradient(135deg,
      #064e3b,
      #115e59);

  color:
    #6ee7b7;

  font-size:
    0.78rem;
  font-weight:
    800;
}

.profile-copy {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}

.profile-copy strong {
  max-width: 13rem;

  overflow: hidden;

  color:
    var(--app-text);

  font-size:
    0.78rem;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;
}

.profile-copy span {
  max-width: 13rem;

  overflow: hidden;

  color:
    var(--app-text-muted);

  font-size:
    0.65rem;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;
}

.mobile-menu {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  cursor: pointer;

  width: 2.3rem;
  height: 2.3rem;

  border: 0;

  border-radius:
    0.65rem;

  background:
    var(--app-surface-2);

  color:
    var(--app-text-secondary);
}

.sidebar-overlay {
  display: none;
}

.app-main {
  min-width: 0;
  max-width: 100%;
  min-height:
    calc(100vh - 4.8rem);

  background:
    radial-gradient(circle at top left,
      rgb(16 185 129 / 0.035),
      transparent 30rem);
}

@media (min-width: 768px) {
  .app-sidebar { transition: width 180ms ease; }
  .app-body { transition: margin-left 180ms ease; }
  .navigation-expanded .app-sidebar { width: 15rem; }
  .navigation-expanded .app-body { margin-left: 15rem; }
  .navigation-expanded .sidebar-brand { justify-content: flex-start; gap: 0.75rem; padding: 0 1rem; }
  .navigation-expanded .brand-name { display: block; color: var(--app-text); font-weight: 800; }
  .navigation-expanded .sidebar-item { flex-direction: row; justify-content: flex-start; min-height: 3.2rem; gap: 0.8rem; padding: 0 0.9rem; font-size: 0.8rem; }
  .navigation-expanded .sidebar-counter { position: static; margin-left: auto; }
}

@media (max-width: 767px) {
  .app-sidebar {
    width: 15rem;

    transform:
      translateX(-100%);

    transition:
      transform 200ms ease;
  }

  .app-sidebar-open {
    transform:
      translateX(0);
  }

  .sidebar-brand {
    justify-content:
      flex-start;

    gap: 0.75rem;

    padding:
      0 1rem;
  }

  .brand-name {
    display: block;

    font-weight: 800;
  }

  .sidebar-item {
    min-height: 3.2rem;

    flex-direction: row;
    justify-content: flex-start;

    gap: 0.8rem;

    padding:
      0 0.9rem;

    font-size:
      0.8rem;
  }

  .sidebar-counter {
    position: static;

    margin-left: auto;
  }

  .app-body {
    margin-left: 0;
  }

  .mobile-menu {
    display: grid;
    place-items: center;
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;

    display: block;

    border: 0;

    background:
      rgb(2 6 23 / 0.68);

    backdrop-filter:
      blur(2px);
  }

  .topbar {
    padding:
      0 1rem;
  }

  .profile-copy {
    display: none;
  }
}
</style>
