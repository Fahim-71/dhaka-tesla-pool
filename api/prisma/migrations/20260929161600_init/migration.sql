-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('ACCEPTED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('REQUESTED', 'MATCHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLAPAY');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "current_area_id" TEXT,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rides" (
    "id" SERIAL NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "pickup_area_id" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "seats_booked" INTEGER NOT NULL DEFAULT 0,
    "status" "RideStatus" NOT NULL DEFAULT 'ACCEPTED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "arrived_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" SERIAL NOT NULL,
    "passenger_id" INTEGER NOT NULL,
    "ride_id" INTEGER,
    "pickup_area_id" TEXT NOT NULL,
    "destination_area_id" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "distance_m" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "base_fare_paisa" INTEGER NOT NULL,
    "distance_charge_paisa" INTEGER NOT NULL,
    "pool_discount_paisa" INTEGER NOT NULL DEFAULT 0,
    "fare_paisa" INTEGER NOT NULL,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "matched_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_events" (
    "id" BIGSERIAL NOT NULL,
    "ride_id" INTEGER,
    "request_id" INTEGER,
    "actor_id" INTEGER,
    "type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "areas_name_key" ON "areas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_id_key" ON "vehicles"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "rides_status_pickup_area_id_idx" ON "rides"("status", "pickup_area_id");

-- CreateIndex
CREATE INDEX "rides_vehicle_id_created_at_idx" ON "rides"("vehicle_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_requests_status_pickup_area_id_idx" ON "ride_requests"("status", "pickup_area_id");

-- CreateIndex
CREATE INDEX "ride_requests_passenger_id_created_at_idx" ON "ride_requests"("passenger_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_requests_ride_id_idx" ON "ride_requests"("ride_id");

-- CreateIndex
CREATE INDEX "ride_events_ride_id_idx" ON "ride_events"("ride_id");

-- CreateIndex
CREATE INDEX "ride_events_request_id_idx" ON "ride_events"("request_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_current_area_id_fkey" FOREIGN KEY ("current_area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_pickup_area_id_fkey" FOREIGN KEY ("pickup_area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_area_id_fkey" FOREIGN KEY ("pickup_area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_destination_area_id_fkey" FOREIGN KEY ("destination_area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written rules. Prisma's schema language cannot express CHECK
-- constraints or partial indexes, so they live here. They are the last line
-- of defence: even if application code has a bug, Postgres refuses to store
-- an impossible state.
-- ---------------------------------------------------------------------------

-- A Tesla has between 1 and 6 seats.
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_capacity_check"
  CHECK ("capacity" BETWEEN 1 AND 6);

-- A ride can never be overbooked (or go negative when seats are released).
ALTER TABLE "rides" ADD CONSTRAINT "rides_capacity_check"
  CHECK ("capacity" BETWEEN 1 AND 6);
ALTER TABLE "rides" ADD CONSTRAINT "rides_seats_booked_check"
  CHECK ("seats_booked" BETWEEN 0 AND "capacity");

-- A request is for 1-3 seats, between two different areas, with a real distance.
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_seats_check"
  CHECK ("seats" BETWEEN 1 AND 3);
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_different_areas_check"
  CHECK ("pickup_area_id" <> "destination_area_id");
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_distance_check"
  CHECK ("distance_m" > 0);

-- Money is never negative, and the breakdown always adds up.
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_money_check"
  CHECK (
    "base_fare_paisa" >= 0 AND "distance_charge_paisa" >= 0 AND
    "pool_discount_paisa" >= 0 AND "fare_paisa" >= 0
  );

-- Pool membership matches the status:
--   REQUESTED            -> not in a ride yet
--   MATCHED / COMPLETED  -> must be in a ride
--   CANCELLED            -> either (cancelled while waiting, or after matching)
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_membership_check"
  CHECK (
    ("status" = 'REQUESTED' AND "ride_id" IS NULL) OR
    ("status" IN ('MATCHED', 'COMPLETED') AND "ride_id" IS NOT NULL) OR
    ("status" = 'CANCELLED')
  );

-- A passenger can have only one active request at a time.
CREATE UNIQUE INDEX "ride_requests_one_active_per_passenger"
  ON "ride_requests" ("passenger_id")
  WHERE "status" IN ('REQUESTED', 'MATCHED');

-- A vehicle can be on only one active ride at a time.
CREATE UNIQUE INDEX "rides_one_active_per_vehicle"
  ON "rides" ("vehicle_id")
  WHERE "status" IN ('ACCEPTED', 'DRIVER_ARRIVED', 'STARTED');
