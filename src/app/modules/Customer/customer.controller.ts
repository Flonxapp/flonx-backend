import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import CustomerService from './customer.service';

const getAllCustomers = catchAsync(async (req, res) => {
  const result = await CustomerService.getAllCustomers(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customers retrieved successfully',
    data: result,
  });
});
const getSingleCustomer = catchAsync(async (req, res) => {
  const result = await CustomerService.getSingleCustomer(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer retrieved successfully',
    data: result,
  });
});
const getPaymentMethods = catchAsync(async (req, res) => {
  const result = await CustomerService.getPaymentMethods(req.user.profileId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment methods retrieved successfully',
    data: result,
  });
});

const CustomerController = {
  getAllCustomers,
  getSingleCustomer,
  getPaymentMethods,
};

export default CustomerController;
