import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import TransactionServices from './transaction.service';

const getMyTransaction = catchAsync(async (req, res) => {
  const result = await TransactionServices.getMyTransaction(
    req.user,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transactions retrieved successfully',
    data: result,
  });
});

const getAllTransaction = catchAsync(async (req, res) => {
  const result = await TransactionServices.getAllTransaction(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transactions retrieved successfully',
    data: result,
  });
});

const getSingleTransaction = catchAsync(async (req, res) => {
  const result = await TransactionServices.getSingleTransaction(
    req.user,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transaction retrieved successfully',
    data: result,
  });
});

const TransactionController = {
  getMyTransaction,
  getAllTransaction,
  getSingleTransaction,
};
export default TransactionController;
