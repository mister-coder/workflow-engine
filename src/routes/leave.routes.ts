const express = require('express');
import { LeaveRequestService } from "../services/leaveRequest.service";

const router = express.Router();
const leaveService = new LeaveRequestService();

/**
 * POST /leave
 * Create a new leave request
 */
router.post("/", async (req: any, res: any) => {
  console.log('creaate')
  try {
    const request = await leaveService.create({
      subject: req.body.subject,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      createdBy: req.body.createdById,
      child: req.body.child,
      secondChild: req.body.secondChild,
    } as any, req.body.createdBy, { startStepKey: 'HR_REVIEW' } );
    res.status(201).json(request);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /leave
 * Update leave request
 */
router.put("/:id", async (req: any, res: any) => {
    console.log('update')
  try {
    const id = Number(req.params.id);
    const userId = Number(req.body.createdById); // Replace with `req.user.id` if using auth
    const data = req.body;

    const updated = await leaveService.update(id, data, userId);
    res.status(200).json(updated);
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
 * POST /leave/actions
 * Perform bulk actions (e.g. submit, approve, reject) on multiple leave request
 */
router.post("/actions", async (req: any, res: any) => {
  // const id = parseInt(req.params.id, 10);
  const { action, performedById, comment, ids } = req.body;

  try {
    const result = await leaveService.performAction(ids, action, performedById, comment);
    res.status(200).json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /leave/getmany
 * Get many leave requests
 */
router.get("/getmany", async (req: any, res: any) => {
  try {
    const data = await leaveService.getMany({});
    res.status(200).json({ data });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /leave/getone
 * Get one leave requests
 */
router.get("/getone", async (req: any, res: any) => {
  try {
    const data = await leaveService.getOne({
      id: 107,
      children: {
        isActive: true,
        subChild: {
          // isActive: false
          // id: (2 || null)
          // id: { $or: [ 1, null ] }
        }
      },
      secondChildren: {
        isActive: true
      }
    });
    const role = 'Employee';
    const action = 'view';
    const permission = data?.currentStepKey ? await leaveService.validateStepPermission(data.currentStepKey, role, action) : {};
    res.status(200).json({ data });
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

/**
 * GET /leave/:id/useractions
 * List all available actions for a leave request
 */
router.get("/:id/useractions", async (req: any, res: any) => {
  const id = parseInt(req.params.id, 10);
  console.log('test', req.params.id, 10);
  try {
    const actions = await leaveService.getAvailableActionsForUser(id, 'Employee');
    res.json(actions);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
