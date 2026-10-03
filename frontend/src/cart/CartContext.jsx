import { createContext, useContext, useMemo, useState } from 'react';
import { getItemPrice } from './pricing';

const CartContext = createContext(null);

function getUnitValue(unit) {
  return unit?.value ?? null;
}

function getItemKey(product, unit) {
  return `${product.id}-${getUnitValue(unit) ?? 'default'}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  function addToCart(product, quantity = 1, unit = null) {
    const unitValue = getUnitValue(unit);

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) =>
          item.product.id === product.id &&
          getUnitValue(item.unit) === unitValue
      );

      if (existingItem) {
        return currentItems.map((item) => {
          if (
            item.product.id === product.id &&
            getUnitValue(item.unit) === unitValue
          ) {
            return {
              ...item,
              quantity: item.quantity + quantity,
            };
          }

          return item;
        });
      }

      return [
        ...currentItems,
        {
          product,
          unit,
          quantity,
        },
      ];
    });
  }

  function updateQuantity(
    productId,
    quantity,
    unitValue = null
  ) {
    if (quantity <= 0) {
      removeFromCart(productId, unitValue);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (
          item.product.id === productId &&
          getUnitValue(item.unit) === unitValue
        ) {
          return {
            ...item,
            quantity,
          };
        }

        return item;
      })
    );
  }

  function removeFromCart(
    productId,
    unitValue = null
  ) {
    setItems((currentItems) =>
      currentItems.filter(
        (item) =>
          !(
            item.product.id === productId &&
            getUnitValue(item.unit) === unitValue
          )
      )
    );
  }

  function clearCart() {
    setItems([]);
  }

  const totalItems = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.quantity,
        0
      ),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      items.reduce((total, item) => {
        const price = getItemPrice(item);

        return total + price * item.quantity;
      }, 0),
    [items]
  );

  const value = {
    items,
    totalItems,
    totalAmount,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getItemKey,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      'useCart must be used inside a CartProvider.'
    );
  }

  return context;
}