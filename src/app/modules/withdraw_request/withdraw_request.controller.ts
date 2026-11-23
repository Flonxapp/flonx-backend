import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import WithdrawRequestService from './withdraw_request.service';

const getWallet = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.getWallet(req.user.profileId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Wallet retrieved successfully',
    data: result,
  });
});

const createWithdrawRequest = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.createWithdrawRequest(
    req.user.profileId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Withdraw request submitted. It will be reviewed by the admin.',
    data: result,
  });
});

const getMyWithdrawRequests = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.getMyWithdrawRequests(
    req.user.profileId,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdraw requests retrieved successfully',
    data: result,
  });
});

const getAllWithdrawRequests = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.getAllWithdrawRequests(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdraw requests retrieved successfully',
    data: result,
  });
});

const getSingleWithdrawRequest = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.getSingleWithdrawRequest(
    req.params.id,
    req.user as { role: string; profileId: string },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdraw request retrieved successfully',
    data: result,
  });
});

const approveWithdrawRequest = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.approveWithdrawRequest(
    req.params.id,
    req.user.profileId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdraw request approved and transferred to the venue owner',
    data: result,
  });
});

const rejectWithdrawRequest = catchAsync(async (req, res) => {
  const result = await WithdrawRequestService.rejectWithdrawRequest(
    req.params.id,
    req.user.profileId,
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdraw request rejected and amount returned to the balance',
    data: result,
  });
});

const WithdrawRequestController = {
  getWallet,
  createWithdrawRequest,
  getMyWithdrawRequests,
  getAllWithdrawRequests,
  getSingleWithdrawRequest,
  approveWithdrawRequest,
  rejectWithdrawRequest,
};

export default WithdrawRequestController;
