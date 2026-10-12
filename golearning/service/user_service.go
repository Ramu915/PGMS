package service

import (
	"context"
	"errors"
	"golearning/model"
	"golearning/repository"
)

type UserService interface {
	CreateUser(ctx context.Context, user *model.User) error
	GetAllUsers(ctx context.Context) ([]model.User, error)
	UpdateUser(ctx context.Context, user *model.User) error
	DeleteUser(ctx context.Context, id int) error
	GetUserByID(ctx context.Context, id int) (*model.User, error)
}
type usersvc struct {
	repo repository.UserRepository
}

func NewUserService(repo repository.UserRepository) UserService {
	return &usersvc{repo: repo}
}

func (u *usersvc) CreateUser(ctx context.Context, user *model.User) error {
	if user.Name == "" {
		return errors.New("name is required")
	}
	if user.Age <= 0 {
		return errors.New("age must be greater than 0")
	}
	if user.Address == "" {
		return errors.New("address is required")
	}
	return u.repo.CreateUser(ctx, user)
}

func (u *usersvc) GetAllUsers(ctx context.Context) ([]model.User, error) {
	return u.repo.GetAllUsers(ctx)
}

func (u *usersvc) UpdateUser(ctx context.Context, user *model.User) error {
	if user.Name == "" {
		return errors.New("name is required")
	}
	if user.Age <= 0 {
		return errors.New("age must be greater than 0")
	}
	if user.Address == "" {
		return errors.New("address is required")
	}
	return u.repo.UpdateUser(ctx, user)
}

func (u *usersvc) DeleteUser(ctx context.Context, id int) error {
	return u.repo.DeleteUser(ctx, id)
}

func (u *usersvc) GetUserByID(ctx context.Context, id int) (*model.User, error) {
	return u.repo.GetUserByID(ctx, id)
}
