import { setup } from "xstate";

export const machine = setup({
  types: {
    context: {} as {},
    events: {} as
      | { type: "NEXT" }
      | { type: "RETRY" }
      | { type: "SKIP" }
      | { type: "LOGIN" }
      | { type: "AWS_SES" }
      | { type: "DIRECT_SEND" }
      | { type: "SELF_HOSTED" }
      | { type: "SIMPLE_MODE" }
      | { type: "FULL_FEATURED_MODE" }
      | { type: "SINGLE_TENANT" }
      | { type: "MULTI_TENANT" }
      | { type: "DISABLE_OVERTURE" }
      | { type: "SCHEMA_SETUP_ERROR" }
      | { type: "SCHEMA_SETUP_SUCCESS" }
      | { type: "DB_CONNECTION_SUCCESS" }
      | { type: "DB_CONNECTION_FAILURE" }
      | { type: "TURFBUILDER_INFRASTRUCTURE" },
  },
}).createMachine({
  context: {},
  id: "Setup Wizard",
  initial: "Confirm Database Connection",
  states: {
    "Confirm Database Connection": {
      on: {
        DB_CONNECTION_FAILURE: {
          target: "Database Help",
        },
        DB_CONNECTION_SUCCESS: {
          target: "Database Schema Setup",
        },
      },
    },
    "Database Help": {
      on: {
        RETRY: {
          target: "Confirm Database Connection",
        },
      },
    },
    "Database Schema Setup": {
      on: {
        SCHEMA_SETUP_SUCCESS: {
          target: "Configure Base URL's",
        },
        SCHEMA_SETUP_ERROR: {
          target: "Error Display",
        },
      },
    },
    "Configure Base URL's": {
      on: {
        NEXT: {
          target: "Select Email Mode",
        },
      },
      description:
        "- User must enter at least one host\n- User may enter as many hosts as they would like",
    },
    "Error Display": {
      on: {
        RETRY: {
          target: "Database Schema Setup",
        },
      },
    },
    "Select Email Mode": {
      on: {
        AWS_SES: {
          target: "Configure AWS SES",
        },
        DIRECT_SEND: {
          target: "Configure Direct Send",
          description:
            "Prior to this option being selected, a warning \n\nshould appear stating that many email providers \n\nblock emails sent via this method. So it should not\n\nbe used without cause.",
        },
      },
    },
    "Configure AWS SES": {
      on: {
        NEXT: {
          target: "Create Admin Account",
        },
      },
    },
    "Configure Direct Send": {
      on: {
        NEXT: {
          target: "Create Admin Account",
        },
      },
    },
    "Create Admin Account": {
      on: {
        NEXT: {
          target: "Select Customizations",
        },
      },
    },
    "Select Customizations": {
      on: {
        NEXT: {
          target: "Select Map Tile Server",
        },
      },
      description:
        "- Select Colors\n- Select Logo\n- Select Application Name\n- Enable/Disable Cat GIFs on error pages",
    },
    "Select Map Tile Server": {
      on: {
        NEXT: {
          target: "Select Tenant Mode",
        },
      },
      description: "- Defaults to OpenMapTiles",
    },
    "Select Tenant Mode": {
      on: {
        SINGLE_TENANT: {
          target: "Single: Select Application Complexity",
        },
        MULTI_TENANT: {
          target: "Allow Anyone to Create an Org",
        },
      },
    },
    "Single: Select Application Complexity": {
      on: {
        SIMPLE_MODE: {
          target: "ST: Connect TurfBuilder Infrastructure Account",
          description: "Sets the new org to simple mode",
        },
        FULL_FEATURED_MODE: {
          target: "Select Overture Host",
        },
      },
      description: "- Creates an org that's the same name as the application",
    },
    "Allow Anyone to Create an Org": {
      on: {
        NEXT: {
          target: "Select Overture Host",
        },
      },
    },
    "ST: Connect TurfBuilder Infrastructure Account": {
      on: {
        SKIP: {
          target: "Finished",
          description:
            "Locks Overture / Disables it... \n\nHowever it is still visible to the user as\n\nan option. When they seect it they will \n\nbe prompted to setup TBI Account again.",
        },
        LOGIN: {
          target: "Finished",
          description:
            "Sets NATs URL to turfbuilders API\n\nSets access key in database",
        },
      },
    },
    "Select Overture Host": {
      on: {
        TURFBUILDER_INFRASTRUCTURE: {
          target: "MT: Connect TurfBuilder Infrastructure Account",
        },
        SELF_HOSTED: {
          target: "Configure NATs URL for Overture",
        },
        DISABLE_OVERTURE: {
          target: "Finished",
        },
      },
    },
    Finished: {
      type: "final",
    },
    "MT: Connect TurfBuilder Infrastructure Account": {
      on: {
        NEXT: {
          target: "Finished",
        },
      },
    },
    "Configure NATs URL for Overture": {
      on: {
        NEXT: {
          target: "Finished",
        },
      },
    },
  },
});
