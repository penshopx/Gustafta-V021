import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIER_TEAM_PLANS,
  totalMembers,
  formatTierTeamPlan,
  formatTeamPlansForPrompt,
  type TierNumber,
} from "../shared/team-blueprints";

test("all 4 tiers present with matching tier numbers", () => {
  for (const t of [1, 2, 3, 4] as TierNumber[]) {
    assert.ok(TIER_TEAM_PLANS[t], `tier ${t} missing`);
    assert.equal(TIER_TEAM_PLANS[t].tier, t);
    assert.ok(TIER_TEAM_PLANS[t].teams.length >= 1, `tier ${t} has no team`);
  }
});

test("tiers 1-3 are single-team; tier 4 is multi-department with a lead", () => {
  assert.equal(TIER_TEAM_PLANS[1].teams.length, 1);
  assert.equal(TIER_TEAM_PLANS[2].teams.length, 1);
  assert.equal(TIER_TEAM_PLANS[3].teams.length, 1);
  assert.ok(TIER_TEAM_PLANS[4].teams.length >= 2, "tier 4 should be multi-team");
  assert.ok(TIER_TEAM_PLANS[4].lead, "tier 4 should have a coordinating lead");
});

test("every team has exactly one orchestrator", () => {
  for (const t of [1, 2, 3, 4] as TierNumber[]) {
    for (const team of TIER_TEAM_PLANS[t].teams) {
      const orchestrators = team.members.filter((m) => m.role === "orchestrator");
      assert.equal(orchestrators.length, 1, `tier ${t} team "${team.name}" must have one orchestrator`);
    }
  }
});

test("totalMembers counts team members plus the lead", () => {
  for (const t of [1, 2, 3, 4] as TierNumber[]) {
    const plan = TIER_TEAM_PLANS[t];
    const expected = plan.teams.reduce((n, tm) => n + tm.members.length, 0) + (plan.lead ? 1 : 0);
    assert.equal(totalMembers(plan), expected);
  }
});

test("gate strings never embed the ◆ marker (added at render time only)", () => {
  for (const t of [1, 2, 3, 4] as TierNumber[]) {
    const plan = TIER_TEAM_PLANS[t];
    const allMembers = [...plan.teams.flatMap((tm) => tm.members), ...(plan.lead ? [plan.lead] : [])];
    for (const m of allMembers) {
      for (const g of m.gates ?? []) {
        assert.ok(!g.includes("◆"), `gate for "${m.title}" should not embed ◆`);
      }
    }
  }
});

test("formatTierTeamPlan renders tier 4 team names and gates with ◆", () => {
  const txt = formatTierTeamPlan(TIER_TEAM_PLANS[4]);
  assert.match(txt, /Tim Marketing/);
  assert.match(txt, /Tim Administrasi/);
  assert.match(txt, /◆/);
});

test("formatTeamPlansForPrompt covers all four tier labels", () => {
  const txt = formatTeamPlansForPrompt();
  assert.match(txt, /Tier 1/);
  assert.match(txt, /Tier 2/);
  assert.match(txt, /Tier 3/);
  assert.match(txt, /Tier 4/);
});
