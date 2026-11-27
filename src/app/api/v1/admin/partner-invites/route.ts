import { api } from "@/bootstrap/container";
export const GET = api.partnerInvites.list;
export const POST = api.partnerInvites.create;
export const DELETE = api.partnerInvites.revoke;
