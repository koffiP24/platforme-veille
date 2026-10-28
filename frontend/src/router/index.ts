import { createRouter, createWebHistory } from "vue-router";

import LoginView from "../views/LoginView.vue";
const ForgotPasswordView = () => import("../views/ForgotPasswordView.vue");
const ResetPasswordView = () => import("../views/ResetPasswordView.vue");
const ChangePasswordView = () => import("../views/ChangePasswordView.vue");
import { useAuthStore } from "../stores/auth";

const DashboardView = () => import("../views/DashboardView.vue");
const UsersView = () => import("../views/UsersView.vue");
const WatchItemsView = () => import("../views/WatchItemsView.vue");
const WatchItemDetailView = () => import("../views/WatchItemDetailView.vue");
const WatchItemQualificationView = () =>
  import("../views/WatchItemQualificationView.vue");
const ActionsView = () => import("../views/ActionsView.vue");
const SubscriptionsView = () => import("../views/SubscriptionsView.vue");
const NotificationsView = () => import("../views/NotificationsView.vue");
const ReportsView = () => import("../views/ReportsView.vue");
const AuditLogsView = () => import("../views/AuditLogsView.vue");
const SystemHealthView = () => import("../views/SystemHealthView.vue");
const TaxonomyView = () => import("../views/TaxonomyView.vue");

const router = createRouter({
  history: createWebHistory(),

  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    if (to.path !== from.path) return { top: 0 };
    return false;
  },

  routes: [
    {
      path: "/audit",
      name: "audit",
      component: AuditLogsView,
      meta: { requiresAuth: true, roles: ["ADMIN", "RESPONSABLE_VEILLE"] },
    },
    {
      path: "/health",
      name: "health",
      component: SystemHealthView,
      meta: { requiresAuth: true, roles: ["ADMIN", "RESPONSABLE_VEILLE"] },
    },
    {
      path: "/subscriptions",
      name: "subscriptions",
      component: SubscriptionsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/notifications",
      name: "notifications",
      component: NotificationsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/reports",
      name: "reports",
      component: ReportsView,
      meta: {
        requiresAuth: true,
        roles: ["ADMIN", "RESPONSABLE_VEILLE"],
      },
    },
    {
      path: "/actions",
      name: "actions",
      component: ActionsView,
      meta: {
        requiresAuth: true,
        roles: ["ADMIN", "RESPONSABLE_VEILLE", "REFERENT_LABORATOIRE"],
      },
    },
    {
      path: "/watch-items/:id",
      name: "watch-item-detail",
      component: WatchItemDetailView,
      meta: {
        requiresAuth: true,
        roles: [
          "ADMIN",
          "RESPONSABLE_VEILLE",
          "REFERENT_LABORATOIRE",
          "OPERATEUR_VEILLE",
          "LECTEUR",
        ],
      },
    },
    {
      path: "/watch-items/:id/qualification",
      name: "watch-item-qualification",
      component: WatchItemQualificationView,
      meta: {
        requiresAuth: true,
        roles: ["ADMIN", "RESPONSABLE_VEILLE", "OPERATEUR_VEILLE"],
      },
    },
    {
      path: "/watch-items",
      name: "watch-items",
      component: WatchItemsView,
      meta: {
        requiresAuth: true,
        roles: [
          "ADMIN",
          "RESPONSABLE_VEILLE",
          "REFERENT_LABORATOIRE",
          "OPERATEUR_VEILLE",
          "LECTEUR",
        ],
      },
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
    },
    {
      path: "/forgot-password",
      name: "forgot-password",
      component: ForgotPasswordView,
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: ResetPasswordView,
    },
    {
      path: "/change-password",
      name: "change-password",
      component: ChangePasswordView,
      meta: {
        requiresAuth: true,
      },
    },

    {
      path: "/",
      name: "dashboard",
      component: DashboardView,
      meta: {
        requiresAuth: true,
      },
    },

    {
      path: "/users",
      name: "users",
      component: UsersView,

      meta: {
        requiresAuth: true,
        adminOnly: true,
      },
    },

    {
      path: "/taxonomy",
      name: "taxonomy",
      component: TaxonomyView,

      meta: {
        requiresAuth: true,
        roles: ["ADMIN"],
      },
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.name === "forgot-password" || to.name === "reset-password") {
    return true;
  }

  const auth = useAuthStore();
  await auth.restoreSession();
  const userRoles = auth.user?.roles ?? [];

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login" };
  }

  // Obligation de changement de mot de passe à la première connexion
  if (auth.isAuthenticated && auth.mustChangePassword) {
    if (to.name !== "change-password") {
      return { name: "change-password" };
    }
    return true;
  }

  // Si l'utilisateur n'a pas besoin de changer son mot de passe
  if (to.name === "change-password") {
    return { name: "dashboard" };
  }

  if (to.meta.adminOnly && !userRoles.includes("ADMIN")) {
    return { name: "dashboard" };
  }

  if (
    Array.isArray(to.meta.roles) &&
    to.meta.roles.length > 0 &&
    !to.meta.roles.some((role) => userRoles.includes(role))
  ) {
    return { name: "dashboard" };
  }

  if (to.name === "login" && auth.isAuthenticated && to.query.recovery !== "1") {
    return { name: "dashboard" };
  }
  return true;
});

export default router;
