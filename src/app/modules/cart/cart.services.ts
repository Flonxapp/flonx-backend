/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import AppError from '../../error/appError';
import Product from '../product/product.model';
import Cart from './cart.model';

interface addToCartProps {
  customerId: string;
  productId: any;
  quantity: number;
}

const addToCart = async ({
  customerId,
  productId,
  quantity,
}: addToCartProps) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }
  let cart = await Cart.findOne({ customer: customerId });

  if (cart) {
    if (cart?.venue?.toString() !== product.venue.toString()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You already add item in cart for a different venue , you need to order those or clear cart then you can add to cart for this item',
      );
    }
  }

  if (!cart) {
    cart = new Cart({
      customer: customerId,
      venue: product.venue,
      venueOwner: product.venueOwner,
      items: [],
    });
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() == productId,
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    const product = await Product.findById(productId).select('price');
    const price = product?.price;

    // Add new item to the cart
    cart.items.push({
      product: productId,
      quantity,
      price: price as number,
    });
  }

  await cart.save();
  return cart;
};

// remove cart item

export const removeCartItem = async (customerId: string, productId: string) => {
  const cart = await Cart.findOne({ customer: customerId });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  cart.items = cart.items.filter(
    (item) => !(item.product.toString() == productId),
  );

  if (cart.items.length == 0) {
    await Cart.findOneAndDelete({ customer: customerId });
    return null;
  } else {
    await cart.save();
    return cart;
  }
};

// view cart

const viewCart = async (customerId: string) => {
  const cart = await Cart.findOne({ customer: customerId }).populate(
    'items.product',
    'name image isAvailable tags price',
  );

  if (!cart) {
    return null;
  }

  return cart;
};

// increase quantity

const increaseCartItemQuantity = async (
  customerId: string,
  productId: string,
) => {
  const cart = await Cart.findOne({ customer: customerId });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  const item = cart.items.find((item) => item.product.toString() == productId);

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Item not found');
  }

  item.quantity += 1;

  await cart.save();
  return cart;
};

// decrease quantity---------------

export const decreaseCartItemQuantity = async (
  customerId: string,
  productId: string,
) => {
  const cart = await Cart.findOne({ customer: customerId });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  const item = cart.items.find((item) => item.product.toString() == productId);

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Item not found');
  }

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Quantity cannot be less than 1',
    );
  }

  await cart.save();
  return cart;
};

const clearCartFromDB = async (customerId: string) => {
  const cart = await Cart.findOne({ customer: customerId });
  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, "You don't have any cart");
  }
  const result = await Cart.findOneAndDelete({ customer: customerId });

  return result;
};

const updateCartItemQuantity = async (
  customerId: string,
  productId: string,
  quantity: number,
) => {
  if (quantity < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Quantity must be at least 1');
  }

  const cart = await Cart.findOne({ customer: customerId });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  const item = cart.items.find((item) => item.product.toString() === productId);

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Item not found');
  }

  // Update quantity
  item.quantity = quantity;
  if (item.quantity == 0) {
    await Cart.findByIdAndDelete(cart._id);
    return null;
  }

  await cart.save();
  return cart;
};

const cartServices = {
  addToCart,
  removeCartItem,
  viewCart,
  increaseCartItemQuantity,
  decreaseCartItemQuantity,
  clearCartFromDB,
  updateCartItemQuantity,
};

export default cartServices;
