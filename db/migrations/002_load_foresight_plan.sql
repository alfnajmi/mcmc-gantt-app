-- =============================================================================
-- MIGRATION 002: Load Foresight Division PERSADA Phase 1 Plan (ClickUp export)
-- =============================================================================
-- WARNING: This TRUNCATES gantt_tasks and gantt_links, then reloads from scratch.
-- Only run if you want to replace ALL existing Gantt data with this plan.
-- =============================================================================

BEGIN;

-- Clear existing data
TRUNCATE gantt_links, gantt_tasks RESTART IDENTITY;

-- =============================================================================
-- LEVEL 0: Top-level projects (root nodes from the CSV)
-- =============================================================================

-- Project 1: RFP Phase 1
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES (1, 'RFP Phase 1', '2026-08-03', 74, 0, 0, 'project', 1, NULL);

-- Project 2: Phase 1 - PERSADA Connectivity/EMR/ICT Deployment
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES (2, 'Phase 1 - PERSADA Connectivity/EMR/ICT Deployment', '2026-10-28', 549, 0, 0, 'project', 2, NULL);

-- =============================================================================
-- LEVEL 1: Major phases under RFP Phase 1 (id=1)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(10, 'Preparation for Invitation for ROI to Potential DUSPs', '2026-08-11', 7, 0, 1, 'project', 1, NULL),
(11, 'Issuance of ROI to DUSP & Evaluation of USP', '2026-08-19', 69, 0, 1, 'project', 2, NULL),
(12, 'Post-NoA', '2026-10-28', 1, 0, 1, 'project', 3, NULL);

-- =============================================================================
-- LEVEL 1: Major phases under Deployment (id=2)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(20, 'Initiation', '2026-10-28', 1, 0, 2, 'project', 1, NULL),
(21, 'Execution & Monitoring', '2026-10-16', 181, 0, 2, 'project', 2, NULL),
(22, 'Post-Deployment – 3 Years Monitoring & Maintenance', '2027-01-13', 1095, 0, 2, 'project', 3, NULL);

-- =============================================================================
-- LEVEL 2: Under "Preparation for ROI" (id=10)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(100, 'RFP Document Preparation', '2026-07-17', 8, 0, 10, 'project', 1, NULL),
(101, 'Circulation of draft RFP', '2026-07-22', 0, 0, 10, 'milestone', 2, NULL),
(102, 'Reviews by USPD, IPD, PEO, QQCAD, FAD, RSCD & NSAICO', '2026-07-22', 4, 0, 10, 'task', 3, NULL),
(103, 'Review of tender documents by CIDO, DMD(D) and MD', '2026-07-22', 3, 0, 10, 'task', 4, NULL),
(104, 'Preparation materials for Tender Committee', '2026-07-31', 1, 0, 10, 'task', 5, NULL),
(105, 'Request date from SGD for Tender Committee', '2026-07-31', 1, 0, 10, 'task', 6, NULL),
(106, 'Meet with DMD(D) and MD for clearance', '2026-08-03', 4, 0, 10, 'task', 7, NULL),
(107, 'Tender Committee (RFP & evaluation strategy)', '2026-08-14', 0, 0, 10, 'milestone', 8, NULL),
(108, 'Commission (Approval on Reg. 5 USP)', '2026-08-18', 0, 0, 10, 'milestone', 9, NULL);

-- =============================================================================
-- LEVEL 2: Under "Issuance of ROI" (id=11)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(110, 'Publish invitation for ROI', '2026-08-19', 0, 0, 11, 'milestone', 1, NULL),
(111, 'Submission of ROI', '2026-08-26', 0, 0, 11, 'milestone', 2, NULL),
(112, 'MCMC-MOH JSC PERSADA No.3', '2026-08-27', 0, 0, 11, 'milestone', 3, NULL),
(113, 'Mandatory Site Survey', '2026-09-01', 20, 0, 11, 'task', 4, NULL),
(114, 'Submission of Draft Universal Plans', '2026-09-22', 0, 0, 11, 'milestone', 5, NULL),
(115, 'Tender evaluation process and report', '2026-09-23', 14, 0, 11, 'project', 6, NULL),
(116, 'Tender Committee (Tender evaluation findings)', '2026-10-19', 0, 0, 11, 'milestone', 7, NULL),
(117, 'Commission (Approval on tender evaluation findings)', '2026-10-27', 0, 0, 11, 'milestone', 8, NULL);

-- =============================================================================
-- LEVEL 2: Under "Post-NoA" (id=12)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(120, 'Issuance of NOA & Kick-off Meeting', '2026-10-28', 0, 0, 12, 'milestone', 1, NULL),
(121, 'MCMC-MOH JSC PERSADA No. 4', '2026-10-28', 0, 0, 12, 'milestone', 2, NULL);

-- =============================================================================
-- LEVEL 2: Under "Initiation" (id=20)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(200, 'NOA and Contract Execution', '2026-10-28', 0, 0, 20, 'milestone', 1, NULL);

-- =============================================================================
-- LEVEL 2: Under "Execution & Monitoring" (id=21)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(210, 'M1 – Mobilisation, Facility Confirmation & Supply Readiness', '2026-10-16', 8, 0, 21, 'project', 1, NULL),
(211, 'M2A – Wi-Fi & Network Infrastructure Deployment', '2026-10-24', 60, 0, 21, 'project', 2, NULL),
(212, 'M2B – EMR & ICT Ancillaries Deployment', '2026-10-24', 60, 0, 21, 'project', 3, NULL),
(213, 'M3 – Testing, Commissioning, RFS & Monitoring', '2026-12-24', 19, 0, 21, 'project', 4, NULL),
(214, 'Milestone claims verified', '2026-12-15', 24, 0, 21, 'task', 5, NULL),
(215, 'Project Governance, Reporting, Safety & Quality', '2026-10-23', 82, 0, 21, 'project', 6, NULL);

-- =============================================================================
-- LEVEL 3: M1 tasks (under id=210)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2100, '1.1 Conduct Phase 1 Implementation Kick-off', '2026-10-28', 8, 0, 210, 'milestone', 1, NULL),
(2101, '1.2 Establish Implementation Governance', '2026-10-16', 3, 0, 210, 'task', 2, NULL),
(2102, '1.3 Confirm Facility Implementation Requirements', '2026-10-16', 5, 0, 210, 'task', 3, NULL),
(2103, '1.4 Confirm AP Locations and Network Routes', '2026-10-17', 4, 0, 210, 'task', 4, NULL),
(2104, '1.5 Complete Technical Design and Design Freeze', '2026-10-19', 3, 0, 210, 'task', 5, NULL),
(2105, '1.6 Confirm EMR and ICT Ancillary Requirements', '2026-10-17', 4, 0, 210, 'task', 6, NULL),
(2106, '1.7 Obtain Site Access and Implementation Approvals', '2026-10-17', 6, 0, 210, 'milestone', 7, NULL),
(2107, '1.8 Procure and Stage Equipment', '2026-10-16', 7, 0, 210, 'task', 8, NULL),
(2108, '1.9 Conduct Equipment Quality Checks', '2026-10-21', 2, 0, 210, 'task', 9, NULL),
(2109, '1.10 Submit Mobilisation Readiness Report', '2026-10-23', 1, 0, 210, 'task', 10, NULL);

-- =============================================================================
-- LEVEL 3: M2A tasks (under id=211)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2110, '2A.1 Mobilise Site Deployment Teams', '2026-10-24', 3, 0, 211, 'milestone', 1, NULL),
(2111, '2A.2 Conduct CME and Enabling Works', '2026-10-24', 15, 0, 211, 'task', 2, NULL),
(2112, '2A.3 Install Trunking, Ducting and Containment', '2026-10-24', 24, 0, 211, 'task', 3, NULL),
(2113, '2A.4 Install Fibre Backbone', '2026-10-28', 31, 0, 211, 'task', 4, NULL),
(2114, '2A.5 Install Structured Network Cabling', '2026-10-23', 39, 0, 211, 'task', 5, NULL),
(2115, '2A.6 Install Network Racks and Power Accessories', '2026-10-28', 27, 0, 211, 'task', 6, NULL),
(2116, '2A.7 Install Switches and Controllers', '2026-11-06', 25, 0, 211, 'task', 7, NULL),
(2117, '2A.8 Install Indoor and Outdoor Access Points', '2026-11-06', 29, 0, 211, 'task', 8, NULL),
(2118, '2A.9 Configure Wi-Fi and Network Equipment', '2026-11-20', 17, 0, 211, 'task', 9, NULL),
(2119, '2A.10 Integrate with Existing Facility Network', '2026-11-27', 14, 0, 211, 'task', 10, NULL),
(2120, '2A.11 Conduct Cabling and Equipment Tests', '2026-12-04', 9, 0, 211, 'task', 11, NULL),
(2121, '2A.12 Conduct Wi-Fi Coverage and Performance Validation', '2026-12-23', 7, 0, 211, 'milestone', 12, NULL);

-- =============================================================================
-- LEVEL 3: M2B tasks (under id=212)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2130, '2B.1 Conduct MOH–EMR Pre-Deployment Meeting', '2026-11-05', 3, 0, 212, 'milestone', 1, NULL),
(2131, '2B.2 Validate Clinic and User Information', '2026-11-05', 8, 0, 212, 'task', 2, NULL),
(2132, '2B.3 Activate EMR Subscriptions', '2026-11-09', 11, 0, 212, 'task', 3, NULL),
(2133, '2B.4 Configure EMR Environment', '2026-11-09', 18, 0, 212, 'task', 4, NULL),
(2134, '2B.5 Procure and Deliver ICT Ancillaries', '2026-11-05', 24, 0, 212, 'task', 5, NULL),
(2135, '2B.6 Perform Asset Verification and Tagging', '2026-11-11', 25, 0, 212, 'task', 6, NULL),
(2136, '2B.7 Install and Configure ICT Hardware', '2026-11-18', 25, 0, 212, 'task', 7, NULL),
(2137, '2B.8 Integrate EMR with MOH Supporting Systems', '2026-11-30', 24, 0, 212, 'task', 8, NULL),
(2138, '2B.9 Conduct Technical and Functional Testing', '2026-12-04', 14, 0, 212, 'task', 9, NULL),
(2139, '2B.10 Prepare and Distribute User Materials', '2026-12-01', 17, 0, 212, 'task', 10, NULL),
(2140, '2B.11 Conduct Virtual EMR Usage Training', '2026-12-02', 15, 0, 212, 'milestone', 11, NULL),
(2141, '2B.12 Conduct EMR User Acceptance Testing', '2026-12-18', 9, 0, 212, 'milestone', 12, NULL),
(2142, '2B.13 Execute Clinic Go-Live', '2026-12-25', 7, 0, 212, 'milestone', 13, NULL);

-- =============================================================================
-- LEVEL 3: M3 tasks (under id=213)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2150, '3.1 Conduct End-to-End Testing', '2027-01-05', 2, 0, 213, 'task', 1, NULL),
(2151, '3.2 Conduct Final Wi-Fi Acceptance Testing', '2027-01-05', 3, 0, 213, 'task', 2, NULL),
(2152, '3.3 Conduct Final EMR Acceptance Testing', '2027-01-05', 3, 0, 213, 'task', 3, NULL),
(2153, '3.4 Rectify Outstanding Defects', '2027-01-06', 4, 0, 213, 'task', 4, NULL),
(2154, '3.5 Obtain Facility and MOH Acceptance', '2027-01-09', 2, 0, 213, 'milestone', 5, NULL),
(2155, '3.6 Declare Go-Live and Ready for Service', '2027-01-11', 1, 0, 213, 'task', 6, NULL),
(2156, '3.7 Conduct Monitoring and Evaluation', '2027-01-05', 7, 0, 213, 'task', 7, NULL),
(2157, '3.8 Submit Completion Documentation', '2027-01-08', 4, 0, 213, 'task', 8, NULL),
(2158, '3.9 Transition to Support and Cooling-Off Period', '2027-01-11', 1, 0, 213, 'task', 9, NULL),
(2159, '3.10 Close Deployment Phase', '2027-01-12', 0, 0, 213, 'milestone', 10, NULL);

-- =============================================================================
-- LEVEL 3: Weekly Reporting & Governance (under id=215)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2160, 'Weekly Reporting Update (In Reporting Platform)', '2026-10-23', 81, 0, 215, 'project', 1, NULL),
(2161, 'PERSADA Connectivity Sub Committee (Periodic)', '2026-12-07', 3, 0, 215, 'milestone', 2, NULL),
(2162, 'Compile Phase 1 Post-Deployment Review & Lessons Learned', '2027-01-12', 30, 0, 215, 'project', 3, NULL);

-- Weekly reports (under id=2160)
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2170, 'Week 1 Report', '2026-10-23', 0, 0, 2160, 'milestone', 1, NULL),
(2171, 'Week 2 Report', '2026-10-30', 0, 0, 2160, 'milestone', 2, NULL),
(2172, 'Week 3 Report', '2026-11-06', 0, 0, 2160, 'milestone', 3, NULL),
(2173, 'Week 4 Report', '2026-11-13', 0, 0, 2160, 'milestone', 4, NULL),
(2174, 'Week 5 Report', '2026-11-20', 0, 0, 2160, 'milestone', 5, NULL),
(2175, 'Week 6 Report', '2026-11-27', 0, 0, 2160, 'milestone', 6, NULL),
(2176, 'Week 7 Report', '2026-12-04', 0, 0, 2160, 'milestone', 7, NULL),
(2177, 'Week 8 Report', '2026-12-11', 0, 0, 2160, 'milestone', 8, NULL),
(2178, 'Week 9 Report', '2026-12-18', 0, 0, 2160, 'milestone', 9, NULL),
(2179, 'Week 10 Report', '2027-01-04', 0, 0, 2160, 'milestone', 10, NULL),
(2180, 'Week 11 Report', '2027-01-11', 0, 0, 2160, 'milestone', 11, NULL);

-- Post-deployment review tasks (under id=2162)
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2190, 'Collect DUSP/Vendor Site Deployment Feedback', '2027-01-13', 10, 0, 2162, 'task', 1, NULL),
(2191, 'Compile Deployment Performance Data & Metrics', '2027-01-13', 7, 0, 2162, 'task', 2, NULL),
(2192, 'Conduct Internal Team Retrospective', '2027-01-20', 7, 0, 2162, 'task', 3, NULL),
(2193, 'Consolidate Key Learnings & Recommendations', '2027-01-24', 9, 0, 2162, 'task', 4, NULL),
(2194, 'Draft Post-Deployment Review Report', '2027-02-02', 7, 0, 2162, 'task', 5, NULL),
(2195, 'Review, Finalize & Present Report to Leadership', '2027-02-09', 3, 0, 2162, 'task', 6, NULL);

-- =============================================================================
-- LEVEL 2: Under "Post-Deployment – 3 Years" (id=22)
-- =============================================================================

INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(220, 'P0 – 12-Month Cooling-Off and Stabilisation', '2027-01-13', 365, 0, 22, 'task', 1, NULL),
(221, 'P1 – 36-Month Warranty & Support Management', '2027-01-13', 1095, 0, 22, 'milestone', 2, NULL),
(222, 'P2 – Monthly Performance & Support Reporting', '2027-01-13', 1095, 0, 22, 'project', 3, NULL),
(223, 'P3 – SLA, Incident & Corrective Maintenance', '2027-01-13', 1095, 0, 22, 'task', 4, NULL),
(224, 'P4 – Preventive Maintenance & Asset Management', '2027-01-13', 1095, 0, 22, 'task', 5, NULL),
(225, 'P5 – DUSP Claims, Payment & Compliance', '2027-01-13', 1095, 0, 22, 'task', 6, NULL),
(226, 'P6 – Annual Performance Review & Audit', '2027-01-13', 1095, 0, 22, 'project', 7, NULL),
(227, 'P7 – Final Performance Assessment & Closeout', '2029-10-13', 91, 0, 22, 'task', 8, NULL);

-- Annual reviews (under P6, id=226)
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2260, 'Annual Review 1 – Cooling-Off & Stabilisation', '2027-12-13', 30, 0, 226, 'task', 1, NULL),
(2261, 'Annual Review 2 – Warranty & Support Performance', '2028-12-13', 30, 0, 226, 'task', 2, NULL),
(2262, 'Annual Review 3 – Final Performance & Closeout Readiness', '2029-12-13', 30, 0, 226, 'task', 3, NULL);

-- Monthly reporting (under P2, id=222) — just year summary bars
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2220, 'Year 1 Monthly Reports (12 reports)', '2027-01-13', 365, 0, 222, 'task', 1, NULL),
(2221, 'Year 2 Monthly Reports (12 reports)', '2028-01-13', 365, 0, 222, 'task', 2, NULL),
(2222, 'Year 3 Monthly Reports (12 reports)', '2029-01-13', 365, 0, 222, 'task', 3, NULL);

-- =============================================================================
-- LINKS: Key finish-to-start dependencies
-- =============================================================================

INSERT INTO gantt_links (source, target, type) VALUES
-- RFP → ROI → Tender → NoA flow
(107, 108, '0'),   -- Tender Committee → Commission approval
(108, 110, '0'),   -- Commission → Publish ROI
(110, 111, '0'),   -- Publish → Submission of ROI
(113, 114, '0'),   -- Site Survey → Submission of Draft Plans
(114, 115, '0'),   -- Draft Plans → Tender evaluation
(116, 117, '0'),   -- Tender Committee findings → Commission approval
(117, 120, '0'),   -- Commission approval → NOA
-- NOA → Deployment
(120, 200, '0'),   -- NOA → Contract Execution
(200, 210, '0'),   -- Contract → M1 Mobilisation
-- M1 → M2A/M2B (start-to-start, type 1)
(210, 211, '1'),   -- M1 → M2A
(210, 212, '1'),   -- M1 → M2B
-- M2A → M3
(2121, 2150, '0'), -- Wi-Fi validation → End-to-End testing
-- M2B → M3
(2142, 2150, '0'), -- Clinic Go-Live → End-to-End testing
-- M3 close → Post-deployment
(2159, 220, '0');  -- Close deployment → Cooling-off

-- =============================================================================
-- Reset sequence to max id + 1
-- =============================================================================
SELECT setval('gantt_tasks_id_seq', (SELECT MAX(id) FROM gantt_tasks) + 1);
SELECT setval('gantt_links_id_seq', (SELECT MAX(id) FROM gantt_links) + 1);

-- PERSADA JSC milestone
INSERT INTO gantt_tasks (id, text, start_date, duration, progress, parent, type, sort_order, status)
VALUES
(2300, 'PERSADA JSC (Periodic)', '2027-01-19', 0, 0, 215, 'milestone', 4, NULL);

COMMIT;

-- =============================================================================
-- VERIFICATION:
-- =============================================================================
-- SELECT type, COUNT(*) FROM gantt_tasks GROUP BY type;
-- Expected: project ~15, task ~55, milestone ~30
-- =============================================================================
