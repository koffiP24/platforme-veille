<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import Button from 'primevue/button';
import Tag from 'primevue/tag';

import {
  useToast,
} from 'primevue/usetoast';

import AppLayout from '../layouts/AppLayout.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SectionCard from '../components/ui/SectionCard.vue';

import {
  getNotifications,
  markNotificationRead,
} from '../services/notifications.service';

import {
  actionError,
  actionSuccess,
} from '../utils/action-toast';


interface NotificationItem {
  id:
  number;

  title:
  string;

  message:
  string;

  createdAt:
  string;

  readAt:
  string | null;
}


type NotificationTab =
  'unread'
  |
  'read';


const notifications =
  ref<NotificationItem[]>([]);

const toast =
  useToast();

const activeTab =
  ref<NotificationTab>(
    'unread',
  );

const loading =
  ref(false);

const reading =
  ref<number[]>([]);


let refreshTimer:
  ReturnType<typeof setInterval>
  | undefined;

let refreshing =
  false;


const unreadNotifications =
  computed(
    () =>
      notifications.value.filter(
        (
          notification,
        ) =>
          !notification.readAt,
      ),
  );


const readNotifications =
  computed(
    () =>
      notifications.value.filter(
        (
          notification,
        ) =>
          Boolean(
            notification.readAt,
          ),
      ),
  );


const visibleNotifications =
  computed(
    () =>
      activeTab.value ===
        'unread'
        ? unreadNotifications.value
        : readNotifications.value,
  );


const dateFormatter =
  new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  );


function formatDate(
  value:
    string
    |
    null
    |
    undefined,
) {
  if (
    !value
  ) {
    return '';
  }

  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? ''
    : dateFormatter.format(
      date,
    );
}


function notifyUnreadCount() {
  window.dispatchEvent(
    new CustomEvent(
      'notifications-changed',

      {
        detail:
          unreadNotifications.value.length,
      },
    ),
  );
}


async function load(
  showLoading =
    true,
) {
  if (
    refreshing
    ||
    (
      !showLoading
      &&
      document.visibilityState !==
      'visible'
    )
  ) {
    return;
  }


  refreshing =
    true;


  if (
    showLoading
  ) {
    loading.value =
      true;
  }


  try {
    notifications.value =
      (
        await getNotifications()
      ).data;

    notifyUnreadCount();

  } finally {
    if (
      showLoading
    ) {
      loading.value =
        false;
    }

    refreshing =
      false;
  }
}


function refreshWhenVisible() {
  if (
    document.visibilityState ===
    'visible'
  ) {
    void load(
      false,
    );
  }
}


async function markAsRead(
  id:
    number,
) {
  reading.value = [
    ...reading.value,
    id,
  ];


  try {
    await markNotificationRead(
      id,
    );

    await load();


    actionSuccess(
      toast,
      'Notification lue',
      'La notification a été déplacée dans la liste des notifications lues.',
    );

  } catch (
  error
  ) {
    actionError(
      toast,
      error,
      'Modification impossible',
      'La notification n’a pas pu être marquée comme lue.',
    );

  } finally {
    reading.value =
      reading.value.filter(
        (
          notificationId,
        ) =>
          notificationId !==
          id,
      );
  }
}


onMounted(
  () => {
    void load();

    document.addEventListener(
      'visibilitychange',
      refreshWhenVisible,
    );

    refreshTimer =
      setInterval(
        () =>
          void load(
            false,
          ),

        15000,
      );
  },
);


onBeforeUnmount(
  () => {
    document.removeEventListener(
      'visibilitychange',
      refreshWhenVisible,
    );

    if (
      refreshTimer
    ) {
      clearInterval(
        refreshTimer,
      );
    }
  },
);
</script>


<template>
  <AppLayout>

    <div class="notifications-page">

      <PageHeader title="Notifications" subtitle="Consultez les alertes et informations générées par vos abonnements."
        eyebrow="Alertes" icon="pi pi-bell" />


      <div class="notification-tabs">

        <button type="button" class="tab-button" :class="{
          active:
            activeTab ===
            'unread',
        }" @click="
          activeTab =
          'unread'
          ">
          <span>
            Non lues
          </span>

          <strong>
            {{
              unreadNotifications.length
            }}
          </strong>
        </button>


        <button type="button" class="tab-button" :class="{
          active:
            activeTab ===
            'read',
        }" @click="
          activeTab =
          'read'
          ">
          <span>
            Lues
          </span>

          <strong>
            {{
              readNotifications.length
            }}
          </strong>
        </button>

      </div>


      <SectionCard>

        <div v-if="
          loading
        " class="loading-zone">
          <AppSpinner centered label="Chargement des notifications…" />
        </div>


        <div v-else-if="
          !visibleNotifications.length
        " class="empty-state">

          <div class="empty-icon">
            <i class="pi pi-bell-slash" />
          </div>

          <strong>
            {{
              activeTab ===
                'unread'
                ? 'Aucune notification non lue'
                : 'Aucune notification lue'
            }}
          </strong>

          <p>
            Les nouvelles alertes apparaîtront ici.
          </p>

        </div>


        <div v-else class="notification-list">

          <article v-for="
notification in
  visibleNotifications
            " :key="notification.id
              " class="notification-item" :class="{
                unread:
                  !notification.readAt,
              }">

            <div class="notification-icon">

              <i :class="notification.readAt
                ? 'pi pi-envelope-open'
                : 'pi pi-envelope'
                " />

            </div>


            <div class="notification-content">

              <div class="notification-heading">

                <div>

                  <h3>
                    {{
                      notification.title
                    }}
                  </h3>

                  <span>
                    {{
                      formatDate(
                        notification.createdAt,
                      )
                    }}
                  </span>

                </div>


                <Tag :value="notification.readAt
                  ? 'Lue'
                  : 'Non lue'
                  " :severity="notification.readAt
                    ? 'secondary'
                    : 'info'
                    " />

              </div>


              <p>
                {{
                  notification.message
                }}
              </p>


              <div class="notification-footer">

                <span v-if="
                  notification.readAt
                ">
                  Lue le
                  {{
                    formatDate(
                      notification.readAt,
                    )
                  }}
                </span>


                <Button v-else label="Marquer comme lue" size="small" :loading="reading.includes(
                  notification.id,
                )
                  " @click="
                    markAsRead(
                      notification.id,
                    )
                    " />

              </div>

            </div>

          </article>

        </div>

      </SectionCard>

    </div>

  </AppLayout>
</template>


<style scoped>
.notifications-page {
  display:
    grid;

  max-width:
    62rem;

  margin:
    0 auto;

  gap:
    1rem;
}

.notification-tabs {
  display:
    flex;

  width:
    fit-content;

  gap:
    0.3rem;

  padding:
    0.3rem;

  border:
    1px solid var(--app-border);

  border-radius:
    0.75rem;

  background:
    var(--app-surface);
}

.tab-button {
  display:
    flex;

  align-items:
    center;

  gap:
    0.5rem;

  border:
    0;

  border-radius:
    0.55rem;

  background:
    transparent;

  color:
    var(--app-text-muted);

  padding:
    0.5rem 0.7rem;

  font-size:
    0.7rem;

  font-weight:
    700;

  cursor:
    pointer;
}

.tab-button strong {
  display:
    grid;

  min-width:
    1.3rem;

  height:
    1.3rem;

  place-items:
    center;

  border-radius:
    999px;

  background:
    var(--app-surface-strong);

  color:
    var(--app-text-secondary);

  font-size:
    0.62rem;
}

.tab-button.active {
  background:
    rgb(16 185 129 / 0.14);

  color:
    var(--app-primary);
}

.tab-button.active strong {
  background:
    var(--app-primary);

  color:
    var(--app-primary-dark);
}

.notification-list {
  display:
    grid;
}

.notification-item {
  display:
    flex;

  gap:
    0.8rem;

  padding:
    1rem 0.3rem;

  border-bottom:
    1px solid var(--app-border);
}

.notification-item:last-child {
  border-bottom:
    0;
}

.notification-item.unread {
  background:
    linear-gradient(90deg,
      rgb(16 185 129 / 0.05),
      transparent);
}

.notification-icon {
  display:
    grid;

  width:
    2.4rem;

  height:
    2.4rem;

  flex:
    0 0 2.4rem;

  place-items:
    center;

  border-radius:
    0.7rem;

  background:
    var(--app-surface-2);

  color:
    var(--app-text-muted);
}

.notification-item.unread .notification-icon {
  background:
    rgb(16 185 129 / 0.12);

  color:
    var(--app-primary);
}

.notification-content {
  min-width:
    0;

  flex:
    1;
}

.notification-heading {
  display:
    flex;

  align-items:
    flex-start;

  justify-content:
    space-between;

  gap:
    1rem;
}

.notification-heading h3 {
  margin:
    0;

  color:
    var(--app-text);

  font-size:
    0.8rem;
}

.notification-heading span,
.notification-footer span {
  color:
    var(--app-text-muted);

  font-size:
    0.65rem;
}

.notification-content>p {
  margin:
    0.45rem 0;

  color:
    var(--app-text-secondary);

  font-size:
    0.73rem;

  line-height:
    1.55;
}

.notification-footer {
  display:
    flex;

  align-items:
    center;

  justify-content:
    flex-end;
}

.loading-zone {
  min-height:
    12rem;
}

.empty-state {
  display:
    flex;

  min-height:
    14rem;

  flex-direction:
    column;

  align-items:
    center;

  justify-content:
    center;

  text-align:
    center;
}

.empty-icon {
  display:
    grid;

  width:
    3.2rem;

  height:
    3.2rem;

  place-items:
    center;

  margin-bottom:
    0.7rem;

  border-radius:
    999px;

  background:
    var(--app-surface-2);

  color:
    var(--app-text-muted);
}

.empty-state strong {
  color:
    var(--app-text-secondary);

  font-size:
    0.8rem;
}

.empty-state p {
  margin:
    0.3rem 0 0;

  color:
    var(--app-text-muted);

  font-size:
    0.7rem;
}
</style>