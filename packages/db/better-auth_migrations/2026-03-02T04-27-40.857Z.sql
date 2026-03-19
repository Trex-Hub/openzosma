create table "users" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailverified" boolean not null, "image" text, "createdat" timestamptz default CURRENT_TIMESTAMP not null, "updatedat" timestamptz default CURRENT_TIMESTAMP not null, "role" text, "banned" boolean, "banreason" text, "banexpires" timestamptz);

create table "sessions" ("id" text not null primary key, "expiresat" timestamptz not null, "token" text not null unique, "createdat" timestamptz default CURRENT_TIMESTAMP not null, "updatedat" timestamptz not null, "ipaddress" text, "useragent" text, "userid" text not null references "users" ("id") on delete cascade, "activeorganizationid" text, "activeteamid" text, "impersonatedby" text);

create table "accounts" ("id" text not null primary key, "accountid" text not null, "providerid" text not null, "userid" text not null references "users" ("id") on delete cascade, "accesstoken" text, "refreshtoken" text, "idtoken" text, "accesstokenexpiresat" timestamptz, "refreshtokenexpiresat" timestamptz, "scope" text, "password" text, "createdat" timestamptz default CURRENT_TIMESTAMP not null, "updatedat" timestamptz not null);

create table "verifications" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresat" timestamptz not null, "createdat" timestamptz default CURRENT_TIMESTAMP not null, "updatedat" timestamptz default CURRENT_TIMESTAMP not null);

create table "organizations" ("id" text not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "createdat" timestamptz not null, "metadata" text);

create table "teams" ("id" text not null primary key, "name" text not null, "organizationid" text not null references "organizations" ("id") on delete cascade, "createdat" timestamptz not null, "updatedat" timestamptz);

create table "teammembers" ("id" text not null primary key, "teamid" text not null references "teams" ("id") on delete cascade, "userid" text not null references "users" ("id") on delete cascade, "createdat" timestamptz);

create table "members" ("id" text not null primary key, "organizationid" text not null references "organizations" ("id") on delete cascade, "userid" text not null references "users" ("id") on delete cascade, "role" text not null, "createdat" timestamptz not null);

create table "invitations" ("id" text not null primary key, "organizationid" text not null references "organizations" ("id") on delete cascade, "email" text not null, "role" text, "teamid" text, "status" text not null, "expiresat" timestamptz not null, "createdat" timestamptz default CURRENT_TIMESTAMP not null, "inviterid" text not null references "users" ("id") on delete cascade);

create table "apikeys" ("id" text not null primary key, "name" text, "start" text, "prefix" text, "key" text not null, "userid" text not null references "users" ("id") on delete cascade, "refillinterval" integer, "refillamount" integer, "lastrefillat" timestamptz, "enabled" boolean, "ratelimitenabled" boolean, "ratelimittimewindow" integer, "ratelimitmax" integer, "requestcount" integer, "remaining" integer, "lastrequest" timestamptz, "expiresat" timestamptz, "createdat" timestamptz not null, "updatedat" timestamptz not null, "permissions" text, "metadata" text);

create index "sessions_userid_idx" on "sessions" ("userid");

create index "accounts_userid_idx" on "accounts" ("userid");

create index "verifications_identifier_idx" on "verifications" ("identifier");

create unique index "organizations_slug_uidx" on "organizations" ("slug");

create index "teams_organizationid_idx" on "teams" ("organizationid");

create index "teammembers_teamid_idx" on "teammembers" ("teamid");

create index "teammembers_userid_idx" on "teammembers" ("userid");

create index "members_organizationid_idx" on "members" ("organizationid");

create index "members_userid_idx" on "members" ("userid");

create index "invitations_organizationid_idx" on "invitations" ("organizationid");

create index "invitations_email_idx" on "invitations" ("email");

create index "apikeys_key_idx" on "apikeys" ("key");

create index "apikeys_userid_idx" on "apikeys" ("userid");