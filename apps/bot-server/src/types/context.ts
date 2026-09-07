import { Context } from 'grammy';
import type { User } from '@alsaada/database';

export interface MyContext extends Context {
  dbUser?: User;
}
