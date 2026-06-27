import type { User } from '@/services/api';

declare global {
  namespace API {
    type CurrentUser = User & {
      permissions?: string[];
      username?: string;
      workStatus?: string;
    };
  }
}

export {};
