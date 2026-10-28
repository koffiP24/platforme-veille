import { defineStore } from "pinia";
import { computed, ref } from "vue";

import api from "../services/api";

export interface CurrentUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  mustChangePassword?: boolean;
}

const USER_CACHE_KEY = "veille_current_user";

function readCachedUser(): CurrentUser | null {
  try {
    const value = sessionStorage.getItem(USER_CACHE_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<CurrentUser>;
    if (
      typeof parsed.id !== "number" ||
      typeof parsed.email !== "string" ||
      !Array.isArray(parsed.roles)
    ) {
      return null;
    }

    return {
      id: parsed.id,
      firstName: typeof parsed.firstName === "string" ? parsed.firstName : "",
      lastName: typeof parsed.lastName === "string" ? parsed.lastName : "",
      email: parsed.email,
      roles: parsed.roles.filter((role): role is string => typeof role === "string"),
      mustChangePassword: Boolean(parsed.mustChangePassword),
    };
  } catch {
    sessionStorage.removeItem(USER_CACHE_KEY);
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<CurrentUser | null>(readCachedUser());
  const initialized = ref(false);

  function setUser(value: CurrentUser | null) {
    user.value = value;
    if (value) {
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(USER_CACHE_KEY);
    }
  }

  const isAuthenticated = computed(
    () => Boolean(user.value),
  );

  const isAdmin = computed(() => user.value?.roles.includes("ADMIN"));

  const mustChangePassword = computed(
    () => Boolean(user.value?.mustChangePassword),
  );

  async function login(email: string, password: string) {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    setUser(response.data.user);
    initialized.value = true;
  }

  async function restoreSession() {
    if (initialized.value) return isAuthenticated.value;
    try {
      const cachedUser = user.value;
      const currentUser = (await api.get<CurrentUser>("/auth/me")).data;
      setUser({
        ...currentUser,
        firstName: currentUser.firstName || cachedUser?.firstName || "",
        lastName: currentUser.lastName || cachedUser?.lastName || "",
        mustChangePassword: Boolean(currentUser.mustChangePassword),
      });
    } catch {
      setUser(null);
    } finally {
      initialized.value = true;
    }
    return isAuthenticated.value;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const response = await api.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    if (response.data?.user) {
      setUser(response.data.user);
    } else if (user.value) {
      setUser({ ...user.value, mustChangePassword: false });
    }
    return response.data;
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      initialized.value = true;
    }
  }

  function clearSession() {
    setUser(null);
  }

  window.addEventListener('auth:unauthorized', clearSession);

  return {
    user,
    initialized,
    isAuthenticated,
    isAdmin,
    mustChangePassword,
    login,
    restoreSession,
    changePassword,
    logout,
  };
});
