// package main

// import "fmt"

// type details struct {
// 	name    string
// 	age     int
// 	college string
// }

// func (p *details) fill(name string, age int, college string) {
// 	p.name = name
// 	p.age = age
// 	p.college = college
// 	fmt.Println(p.name)
// 	fmt.Println(p.age)
// 	fmt.Println(p.college)
// }

// func main() {
// 	var student details
// 	student.fill("ramu", 10, "UCST")
// }

// package main

// import (
// 	"encoding/json"
// 	"log"
// 	"net/http"
// )

// type User struct {
// 	Name    string `json:"name"`
// 	Age     int    `json:"age"`
// 	College string `json:"college"`
// }

// func getUser(w http.ResponseWriter, r *http.Request) {

// 	users := []User{
// 		{
// 			Name:    "ramu",
// 			Age:     20,
// 			College: "UCST",
// 		},
// 		{
// 			Name:    "Bheem",
// 			Age:     20,
// 			College: "UCST",
// 		},
// 		{
// 			Name:    "Ravan",
// 			Age:     20,
// 			College: "UCST",
// 		},
// 	}

// 	err := json.NewEncoder(w).Encode(users)
// 	if err != nil {
// 		log.Println(err)
// 	}
// }

// func main() {
// 	http.HandleFunc("/users", getUser)

// 	log.Fatal(http.ListenAndServe(":8080", nil))
// }

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
)

type user struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

type userdto struct {
	Name    string `json:"name"`
	Age     int    `json:"age"`
	Address string `json:"address"`
	Id      int    `json:"id"`
}

var users = []userdto{
	{
		Id:      1,
		Name:    "ramu",
		Age:     20,
		Address: "hyd",
	},
	{
		Id:      2,
		Name:    "Bheem",
		Age:     20,
		Address: "tmk",
	},
	{
		Id:      3,
		Name:    "Ravan",
		Age:     20,
		Address: "ban",
	},
}

func createUser(w http.ResponseWriter, r *http.Request) {

	var user user

	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate new user
	if user.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	if user.Age <= 0 {
		http.Error(w, "Age must be greater than 0", http.StatusBadRequest)
		log.Println("Age must be greater than 0")
		return
	}

	// Check duplicate name
	for _, u := range users {

		if u.Name == user.Name {
			http.Error(w, "User already exists", http.StatusBadRequest)
			log.Println("User already exists")
			return
		}
	}

	users = append(users, userdto{
		Id:   len(users) + 1,
		Name: user.Name,
		Age:  user.Age,
	})

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func readAllUsers(w http.ResponseWriter, r *http.Request) {

	name := r.URL.Query().Get("name")

	if name == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(users)
		return
	}

	var result []userdto

	for _, u := range users {
		if u.Name == name {
			result = append(result, u)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func readUser(w http.ResponseWriter, r *http.Request) {

	idstr := r.PathValue("id")
	id, err := strconv.Atoi(idstr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	for i := range users {

		if users[i].Id == id {

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(users[i])
			return
		}
	}

	http.Error(w, "User not found", http.StatusNotFound)
}

func update(w http.ResponseWriter, r *http.Request) {

	var req userdto

	// Get ID from URL
	idstr := r.PathValue("id")

	id, err := strconv.Atoi(idstr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	// Read JSON
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		log.Println("Invalid JSON")
		return
	}

	// Validate data
	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		log.Println("Name is required")
		return
	}

	if req.Age <= 0 {
		http.Error(w, "Age must be greater than 0", http.StatusBadRequest)
		log.Println("Age must be greater than 0")
		return
	}

	// Find user
	for i := range users {

		if users[i].Id == id {

			// Update user
			users[i].Name = req.Name
			users[i].Age = req.Age
			users[i].Address = req.Address

			w.Header().Set("Content-Type", "application/json")

			json.NewEncoder(w).Encode(users[i])

			return
		}
	}

	// Only reached if loop couldn't find the ID
	http.Error(w, "User not found", http.StatusNotFound)
}

func delete(w http.ResponseWriter, r *http.Request) {

	idstr := r.PathValue("id")

	id, err := strconv.Atoi(idstr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	for i := range users {

		if users[i].Id == id {

			deletedUser := users[i]

			users = append(users[:i], users[i+1:]...)

			w.Header().Set("Content-Type", "application/json")

			json.NewEncoder(w).Encode(deletedUser)

			log.Println("Deleted user:", deletedUser)

			return
		}
	}

	http.Error(w, "User not found", http.StatusNotFound)
}

func main() {

	http.HandleFunc("POST /users", createUser)
	http.HandleFunc("GET /users", readAllUsers)
	http.HandleFunc("GET /users/{id}", readUser)
	http.HandleFunc("PUT /users/{id}", update)
	http.HandleFunc("DELETE /users/{id}", delete)

	log.Println("Server started on http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", nil))
}
