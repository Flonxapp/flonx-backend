import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import JobApplicationService from './job_application.service';

// 🍸 Apply
const applyJob = catchAsync(async (req, res) => {
  const result = await JobApplicationService.applyJob(
    req.user.profileId,
    req.params.jobId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Applied successfully',
    data: result,
  });
});

// ✅ Accept / Reject
const acceptApplication = catchAsync(async (req, res) => {
  const result = await JobApplicationService.acceptApplication(
    req.user.profileId,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application accepted successfully',
    data: result,
  });
});

// 📄 Get applications of a job
const getByJob = catchAsync(async (req, res) => {
  const result = await JobApplicationService.getApplicationsByJob(
    req.params.jobId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Applications retrieved',
    data: result,
  });
});

// 📄 My applications
const getMine = catchAsync(async (req, res) => {
  const result = await JobApplicationService.getMyApplications(
    req.user.profileId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My applications retrieved',
    data: result,
  });
});
const getSingle = catchAsync(async (req, res) => {
  const result = await JobApplicationService.getSingleJobApplication(
    req.params.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Single job retrieved successfully',
    data: result,
  });
});
const cancelApplication = catchAsync(async (req, res) => {
  const result = await JobApplicationService.cancelApplication(
    req.user.profileId,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application cancelled successfully',
    data: result,
  });
});

const JobApplicationController = {
  applyJob,
  acceptApplication,
  getByJob,
  getMine,
  getSingle,
  cancelApplication,
};

export default JobApplicationController;
