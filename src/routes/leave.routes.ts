const express = require('express');
import { LeaveRequestService } from "../services/leaveRequest.service";

const router = express.Router();
const leaveService = new LeaveRequestService();

/**
 * POST /leave
 * Create a new leave request
 */
router.post("/", async (req: any, res: any) => {
  try {
    const request = await leaveService.createRequest({
      subject: req.body.subject,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      createdById: req.body.createdById,
    });
    res.status(201).json(request);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /leave/:id/action
 * Perform an action (e.g. submit, approve, reject) on a leave request
 */
router.post("/:id/action", async (req: any, res: any) => {
  const id = parseInt(req.params.id, 10);
  const { action, performedById, comment } = req.body;

  try {
    await leaveService.performAction(id, action, performedById, comment);
    res.status(200).json({ message: "Action performed." });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /leave/:id/actions
 * List all available actions for a leave request
 */
router.get("/:id/actions", async (req: any, res: any) => {
  const id = parseInt(req.params.id, 10);
  try {
    const actions = await leaveService.getAvailableActions(id);
    res.json(actions);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
