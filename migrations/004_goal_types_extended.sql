-- Extend allowed goal_type values so users can plan for weddings, pets,
-- cars, travel, etc. Idempotent: drops and re-adds the CHECK so it works
-- on already-deployed databases.

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_goal_type_check;

ALTER TABLE goals
  ADD CONSTRAINT goals_goal_type_check
  CHECK (
    goal_type IN (
      'retirement',
      'house',
      'college',
      'emergency',
      'wedding',
      'pet',
      'car',
      'travel',
      'other'
    )
  );
