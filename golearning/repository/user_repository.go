package repository

import (
	"context"
	"database/sql"
	"golearning/model"
	"log"
)

type UserRepository interface {
	CreateUser(ctx context.Context, user *model.User) error
	UpdateUser(ctx context.Context, user *model.User) error
	DeleteUser(ctx context.Context, id int) error
	GetUserByID(ctx context.Context, id int) (*model.User, error)
	GetAllUsers(ctx context.Context) ([]model.User, error)
}

type userdb struct {
	db *sql.DB
}

func NewUserDB(db *sql.DB) UserRepository {
	return &userdb{db: db}
}

func (u *userdb) GetAllUsers(ctx context.Context) ([]model.User, error) {
	query := `SELECT id, name, age, address FROM users`
	rows, err := u.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var user model.User
		if err := rows.Scan(&user.Id, &user.Name, &user.Age, &user.Address); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

func (u *userdb) CreateUser(ctx context.Context, user *model.User) error {
	query := `INSERT INTO users(name, age, address) VALUES($1, $2, $3) RETURNING id`
	err := u.db.QueryRowContext(ctx, query, user.Name, user.Age, user.Address).Scan(&user.Id)
	if err != nil {
		log.Println("Error inserting user:", err)
		return err
	}
	return nil
}

func (u *userdb) UpdateUser(ctx context.Context, user *model.User) error {
	query := `UPDATE users SET name = $1, age = $2, address = $3 WHERE id = $4`
	_, err := u.db.ExecContext(ctx, query, user.Name, user.Age, user.Address, user.Id)
	return err
}

func (u *userdb) DeleteUser(ctx context.Context, id int) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := u.db.ExecContext(ctx, query, id)
	return err
}

func (u *userdb) GetUserByID(ctx context.Context, id int) (*model.User, error) {
	query := `SELECT id, name, age, address FROM users WHERE id = $1`
	var user model.User
	err := u.db.QueryRowContext(ctx, query, id).Scan(&user.Id, &user.Name, &user.Age, &user.Address)
	if err != nil {
		return nil, err
	}
	return &user, nil
}
