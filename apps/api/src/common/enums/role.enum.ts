// Mirrors the `Role` enum in prisma/schema.prisma — kept as a plain TS enum here
// so guards/decorators don't need a Prisma Client import at the type-decoration level.
export enum Role {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}
