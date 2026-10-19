import api from "./api";

export interface FollowUpAction {
  id: number;
  title: string;
  description: string | null;
  actionType: string;
  impact: string | null;
  decision: string | null;
  dueDate: string | null;
  progressComment: string | null;
  result: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  createdAt: string;
  owner: { id: number; firstName?: string; lastName?: string; email: string };
  watchItem?: { id: number; title: string };
}

export function getActions(itemId: number) {
  return api.get<FollowUpAction[]>(`/watch-items/${itemId}/actions`);
}
export function getAllActions() {
  return api.get<FollowUpAction[]>("/actions");
}
export function getMyPendingActionCount() {
  return api.get<{ count: number }>("/actions/my-pending-count");
}

function notifyActionsChanged() {
  window.dispatchEvent(new CustomEvent('actions-changed'));
}

export async function createAction(
  itemId: number,
  payload: {
    title: string;
    description?: string;
    actionType: string;
    impact?: string;
    dueDate?: string;
    ownerId: number;
    progressComment?: string;
    result?: string;
  },
) {
  const response = await api.post(`/watch-items/${itemId}/actions`, payload);
  notifyActionsChanged();
  return response;
}
export async function updateAction(
  id: number,
  payload: {
    title?: string;
    description?: string;
    actionType?: string;
    ownerId?: number;
    status?: string;
    impact?: string;
    decision?: string;
    dueDate?: string | null;
    progressComment?: string;
    result?: string;
  },
) {
  const response = await api.patch(`/actions/${id}`, payload);
  notifyActionsChanged();
  return response;
}

export async function deleteAction(id: number) {
  const response = await api.delete<{ id: number; deleted: boolean }>(`/actions/${id}`);
  notifyActionsChanged();
  return response;
}
