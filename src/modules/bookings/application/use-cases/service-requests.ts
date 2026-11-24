import { AppError } from "@/shared/application/app-error";
import {
  assigneeProblem,
  nextServiceStatus,
  type ServiceAction,
} from "../../domain/service-request";
import type { Notifier } from "../ports/notifier";
import type {
  QueuedService,
  ServiceRequestRepository,
} from "../ports/service-request-repository";

// Marks requests nobody was matched to in time. There is no scheduled job
// yet (D7), so the queue and the traveller's booking pages run this before
// they read.
export class ExpireOverdueServices {
  constructor(
    private readonly services: ServiceRequestRepository,
    private readonly notifier: Notifier,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute() {
    const expired = await this.services.expireOverdue(this.clock());
    for (const s of expired) await this.notifier.serviceUpdated(s);
  }
}

// Staff's matching queue.
export class ListServiceQueue {
  constructor(
    private readonly services: ServiceRequestRepository,
    private readonly expire: ExpireOverdueServices,
  ) {}

  async execute() {
    await this.expire.execute();
    return this.services.listQueue();
  }
}

// Staff match someone, mark a request as unmatched (refund due), or mark it
// completed after the service. The traveller is told each time.
export class UpdateServiceRequest {
  constructor(
    private readonly services: ServiceRequestRepository,
    private readonly notifier: Notifier,
  ) {}

  async execute(
    actorId: string,
    action: ServiceAction,
  ): Promise<QueuedService> {
    const current = await this.services.find(action.id);
    if (!current)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Request not found.");
    const status = nextServiceStatus(current.status, action.action);
    if (!status)
      throw new AppError(
        "CONFLICT",
        "INVALID_TRANSITION",
        current.status === "UNMATCHED"
          ? "This request is already marked for a refund."
          : "This request can’t change that way any more.",
      );
    if (action.action === "MATCH") {
      const problem = assigneeProblem(current.service, action.assignee);
      if (problem) throw new AppError("INVALID", "INVALID_ASSIGNEE", problem);
    }
    const updated = await this.services.update({
      id: action.id,
      expectedVersion: action.expectedVersion,
      status,
      assignee: action.action === "MATCH" ? action.assignee : null,
      actorType: "STAFF",
      actorId,
      note: action.action === "UNMATCH" ? action.note : null,
    });
    if (!updated)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Someone else changed this request. Reload the queue.",
      );
    await this.notifier.serviceUpdated(updated);
    return updated;
  }
}
