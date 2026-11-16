import { Injectable, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../api/notifications.api';
import { AuthService } from '../auth/auth.service';

export interface TicketChange {
  readonly ticketId: string;
  /** What happened: created, updated or message. */
  readonly change: string;
}

/** Live connection to the API. It delivers ticket changes of the workspace and the user's notifications. */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private connection: HubConnection | null = null;

  readonly ticketChanges = new Subject<TicketChange>();
  readonly notifications = new Subject<AppNotification>();
  readonly connected = signal(false);

  /** Opens the connection if it is not open yet. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.connection) {
      return;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/notifications`, {
        accessTokenFactory: () => this.currentToken(),
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();
    this.connection = connection;

    connection.on('ticketChanged', (change: TicketChange) => this.ticketChanges.next(change));
    connection.on('notification', (notification: AppNotification) =>
      this.notifications.next(notification),
    );
    connection.onreconnected(() => this.connected.set(true));
    connection.onreconnecting(() => this.connected.set(false));
    connection.onclose(() => this.connected.set(false));

    try {
      await connection.start();
      this.connected.set(connection.state === HubConnectionState.Connected);
    } catch {
      // The app works without live updates; lists simply refresh when the user acts.
      this.connected.set(false);
    }
  }

  async stop(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.connected.set(false);
    await connection?.stop();
  }

  /** The access token lives only 15 minutes, so every (re)connect asks for a fresh one when needed. */
  private async currentToken(): Promise<string> {
    const expiresSoon = this.auth.accessTokenExpiresWithin(60_000);
    if (this.auth.accessToken() && !expiresSoon) {
      return this.auth.accessToken() ?? '';
    }

    try {
      return await firstValueFrom(this.auth.refresh());
    } catch {
      return '';
    }
  }
}
