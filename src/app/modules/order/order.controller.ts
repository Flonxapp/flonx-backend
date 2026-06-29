import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import OrderService from './order.service';

const createOrder = catchAsync(async (req, res) => {
  const result = await OrderService.createOrder(
    req?.user?.profileId,
    req.body.paymentMethodId,
  );

  console.log('Order created with result:', result);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order created successfully',
    data: result,
  });
});
const getMyOrders = catchAsync(async (req, res) => {
  const result = await OrderService.getMyOrders(
    req?.user?.profileId,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order retrieved successfully',
    data: result,
  });
});
const getAllOrder = catchAsync(async (req, res) => {
  const result = await OrderService.getAllOrder(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order retrieved successfully',
    data: result,
  });
});
const getSingleOrder = catchAsync(async (req, res) => {
  const result = await OrderService.getSingleOrder(
    req?.user?.profileId,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order retrieved successfully',
    data: result,
  });
});

const markAsUnavailableAndRefund = catchAsync(async (req, res) => {
  const result = await OrderService.markAsUnavailableAndRefund(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order cancelled and refund initiated successfully',
    data: result,
  });
});
const changeStatus = catchAsync(async (req, res) => {
  const result = await OrderService.changeOrderStatus(
    req.user,
    req.params.id,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order status updated successfully',
    data: result,
  });
});
const tipToBartender = catchAsync(async (req, res) => {
  const result = await OrderService.tipToBartender(
    req.params.id,
    req.body.amount,
    req?.body?.paymentMethodId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tip payment initiated successfully',
    data: result,
  });
});

const OrderController = {
  createOrder,
  getMyOrders,
  getAllOrder,
  getSingleOrder,
  markAsUnavailableAndRefund,
  changeStatus,
  tipToBartender,
};

export default OrderController;
