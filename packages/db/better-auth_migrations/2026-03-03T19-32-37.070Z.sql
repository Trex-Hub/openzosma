alter table "users" add column "twofactorenabled" boolean;

create table "twofactors" ("id" text not null primary key, "secret" text not null, "backupcodes" text not null, "userid" text not null references "users" ("id") on delete cascade);

create index "twofactors_secret_idx" on "twofactors" ("secret");

create index "twofactors_userid_idx" on "twofactors" ("userid");