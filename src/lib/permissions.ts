// lib/permissions.ts
import { createAccessControl } from "better-auth/plugins/access";

// Define what actions can be performed on what resources
export const statement = {
  user: ["create", "read", "update", "delete", "ban"],
  turf: ["create", "read", "update", "delete"],
  region: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const userRole = ac.newRole({
  user: ["read"],
  turf: ["read"],
  region: ["read"]
});

export const fieldOrganizerRole = ac.newRole({
  user: ["create", "read", "update", "delete", "ban"],
  turf: ["create", "read", "update", "delete"],
  region: ["read"],
});

export const campaignManagerRole = ac.newRole({
  user: ["create", "read", "update", "delete", "ban"],
  turf: ["create", "read", "update", "delete"],
  region: ["create", "read", "update", "delete"],
});