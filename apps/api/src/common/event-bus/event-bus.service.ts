import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { DomainEventName, DomainEvents } from './events';

/**
 * Minimal in-process domain event bus — built on Node's EventEmitter rather
 * than pulling in @nestjs/event-emitter, since the only requirement right now
 * is decoupling publishers from subscribers within a single process (modular
 * monolith, per ARCHITECTURE.md §1). Swapping this for Redis pub/sub or SQS
 * later (ARCHITECTURE.md §7) only requires changing this one class — every
 * publisher/subscriber already goes through `emit`/`on`, not a direct
 * service-to-service call.
 *
 * A handler that throws is caught and logged, not re-thrown into the
 * publisher — a failed side effect (e.g. an email that didn't send) must
 * never roll back or fail the operation that published the event.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly emitter = new EventEmitter();

  emit<E extends DomainEventName>(event: E, payload: DomainEvents[E]): void {
    this.emitter.emit(event, payload);
  }

  on<E extends DomainEventName>(event: E, handler: (payload: DomainEvents[E]) => Promise<void> | void): void {
    this.emitter.on(event, async (payload: DomainEvents[E]) => {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error(`Handler for "${event}" failed`, error as Error);
      }
    });
  }
}
