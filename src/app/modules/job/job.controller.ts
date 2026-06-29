/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import JobService from './job.service';

const createJob = catchAsync(async (req, res) => {
  const result = await JobService.createJob(req.user.profileId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job created successfully',
    data: result,
  });
});

const updateJob = catchAsync(async (req, res) => {
  const result = await JobService.updateJob(
    req.user.profileId,
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job updated successfully',
    data: result,
  });
});

const deleteJob = catchAsync(async (req, res) => {
  const result = await JobService.deleteJob(req.user.profileId, req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job deleted successfully',
    data: result,
  });
});

// 📄 Get All Jobs
const getAllJobs = catchAsync(async (req, res) => {
  const result = await JobService.getAllJobsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Jobs retrieved successfully',
    data: result,
  });
});

const getSingleJob = catchAsync(async (req, res) => {
  const result = await JobService.getSingleJob(req.params.id, req.user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job retrieved successfully',
    data: result,
  });
});
const getMyJobs = catchAsync(async (req, res) => {
  const result = await JobService.getMyJobs(req.user, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job retrieved successfully',
    data: result,
  });
});
const markAsComplete = catchAsync(async (req, res) => {
  const result = await JobService.markAsComplete(
    req.user.profileId,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job marked as complete successfully',
    data: result,
  });
});
const cancelJob = catchAsync(async (req, res) => {
  const result = await JobService.cancelJob(req.user, req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job cancelled successfully',
    data: result,
  });
});

const JobController = {
  createJob,
  updateJob,
  deleteJob,
  getAllJobs,
  getSingleJob,
  getMyJobs,
  markAsComplete,
  cancelJob,
};

export default JobController;
