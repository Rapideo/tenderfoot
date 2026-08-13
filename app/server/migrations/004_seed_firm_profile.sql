-- SP1 T4. Koehler Partners as an ordinary vendor row, with the Profile attached.
--
-- §4.2: KP being a vendor row like any other is what keeps the system
-- portable. A second customer is a second row, not a fork.
--
-- Values are real, taken from the prototype's Admin screen, which was itself
-- built from the design spec. Nothing here is invented.

INSERT INTO vendor (name, is_self, source_note)
VALUES ('Koehler Partners', true, 'The firm this instance is configured for. §4.2.');

INSERT INTO vendor_alias (vendor_id, alias, source_note)
SELECT id, 'KP', 'Internal shorthand.' FROM vendor WHERE is_self;

INSERT INTO firm_profile (
  vendor_id, capabilities, codes, certifications, geography, remote_ok,
  hard_limits, past_performance, negative_profile
)
SELECT
  v.id,
  'Care-management workflow redesign · Multi-stakeholder facilitation · Program evaluation · '
  || 'Capacity building for CBOs · Managed care operations · Project management oversight · '
  || 'Training and talent development · Stakeholder research · Process optimization · AI governance',
  ('{"naics":["541611","541612","541618","541690","541720","611430"],'
    || '"psc":["R408","R410","R422","R499","B506"],'
    || '"note":"Codes are a SIGNAL, never a filter (§6.2). They are frequently missing or '
    || 'wrong in state and local procurement, and using them to gate is the most common way '
    || 'these systems develop a silent recall problem."}')::jsonb,
  '{"wbe":{"state":"IN","expires":"2027-04"},"mbe":"pending"}'::jsonb,
  ('{"primary":["IN"],"secondary":["IL","OH","KY"],"federal":true,'
    || '"note":"Scope is a Profile setting, not code (§1A). Illinois matters more since '
    || '2026-08-12: it is the only non-federal source retaining closed solicitations."}')::jsonb,
  true,
  ('{"headcount":14,"trailing_revenue_usd":2800000,"bonding_capacity":null,'
    || '"note":"ELIGIBILITY THRESHOLDS ONLY (§1). These answer whether KP can legally bid, '
    || 'never whether KP should take work on. The system is capacity-agnostic -- and that '
    || 'rule binds the machine, not the user."}')::jsonb,
  NULL,   -- past performance: records not accessible (§7.3). Stays empty by decision.
  NULL    -- negative profile: lost its last source when the hand-run was retired 2026-08-11.
FROM vendor v WHERE v.is_self;
