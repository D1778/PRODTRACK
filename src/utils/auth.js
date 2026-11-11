export const isAuthenticated = () => {
  return localStorage.getItem("isLoggedIn") === "true";
};

export const loginUser = () => {
  localStorage.setItem("isLoggedIn", "true");
};

export const logoutUser = () => {
  localStorage.removeItem("isLoggedIn");
};
