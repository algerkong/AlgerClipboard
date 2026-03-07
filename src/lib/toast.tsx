import { notify } from "@/services/notificationService";

export const toast = {
  success(message: string) {
    notify.success(message);
  },
  error(message: string) {
    notify.error(message);
  },
  info(message: string) {
    notify.info(message);
  },
};
