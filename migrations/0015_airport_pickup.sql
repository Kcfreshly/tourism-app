-- Airport pickup: travellers arriving from abroad can have a driver meet
-- them. It is a service line in the single trip payment, priced from
-- transport settings (airportPickupMinor), and matched by staff like cars
-- and guides. See docs/CUSTOMER_ONBOARDING_TODO.md, section 2.
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_service_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_service_check CHECK (service IN ('CAR', 'NIGHT_CAR', 'FULL_DAY_GUIDE', 'ACTIVITY_GUIDE', 'AIRPORT_PICKUP'));
