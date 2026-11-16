package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Profile pictures and business logos are small images (the browser shrinks
// them to a few KB) stored as data URLs inside the user / business document.
// Only raster formats are accepted: SVG could carry scripts.
const maxImageBytes = 100 * 1024

var imageTypes = map[string][]byte{
	"image/png":  {0x89, 'P', 'N', 'G'},
	"image/jpeg": {0xff, 0xd8, 0xff},
	"image/webp": []byte("RIFF"),
}

// checkImage validates a data URL. An empty string is valid and means "remove".
func checkImage(dataURL string) error {
	if dataURL == "" {
		return nil
	}
	header, payload, ok := strings.Cut(dataURL, ";base64,")
	mime, hasPrefix := strings.CutPrefix(header, "data:")
	magic, known := imageTypes[mime]
	if !ok || !hasPrefix || !known {
		return errors.New("Please choose a PNG, JPEG or WebP image")
	}
	if len(payload) > maxImageBytes*4/3+4 {
		return errors.New("That image is too large. Choose a smaller one")
	}
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil || len(raw) == 0 || !bytes.HasPrefix(raw, magic) {
		return errors.New("That doesn't look like a valid image")
	}
	if mime == "image/webp" && (len(raw) < 12 || string(raw[8:12]) != "WEBP") {
		return errors.New("That doesn't look like a valid image")
	}
	if len(raw) > maxImageBytes {
		return errors.New("That image is too large. Choose a smaller one")
	}
	return nil
}

// PUT /api/auth/avatar  {image}   (any logged-in user; "" removes it)
func (a *App) updateAvatar(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	var req struct {
		Image string `json:"image"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := checkImage(req.Image); err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}
	update := bson.M{"$set": bson.M{"avatar": req.Image}}
	if req.Image == "" {
		update = bson.M{"$unset": bson.M{"avatar": ""}}
	}
	if _, err := a.store.users.UpdateByID(r.Context(), user.ID, update); err != nil {
		serverError(w, "update avatar", err)
		return
	}
	sendJSON(w, http.StatusOK, map[string]any{"message": "Profile picture updated", "user": a.userView(r.Context(), user)})
}

// PUT /api/business  {name, logo?}   (owner only)
// logo is optional: leave it out to keep the current picture, send "" to remove it.
func (a *App) updateBusiness(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	var req struct {
		Name string  `json:"name"`
		Logo *string `json:"logo"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 120 {
		sendError(w, http.StatusBadRequest, "Please enter your business name")
		return
	}
	set := bson.M{"name": req.Name}
	update := bson.M{"$set": set}
	if req.Logo != nil {
		if err := checkImage(*req.Logo); err != nil {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		if *req.Logo == "" {
			update["$unset"] = bson.M{"logo": ""}
		} else {
			set["logo"] = *req.Logo
		}
	}
	if _, err := a.store.businesses.UpdateByID(r.Context(), user.BusinessID, update); err != nil {
		serverError(w, "update business", err)
		return
	}
	sendJSON(w, http.StatusOK, map[string]any{"message": "Business updated", "user": a.userView(r.Context(), user)})
}

// userAvatar loads just the avatar. Requests don't load it with the user (see
// requireAuth) so a large picture doesn't slow every API call.
func (a *App) userAvatar(ctx context.Context, id bson.ObjectID) string {
	var doc struct {
		Avatar string `bson:"avatar"`
	}
	_ = a.store.users.FindOne(ctx, bson.M{"_id": id},
		options.FindOne().SetProjection(bson.M{"avatar": 1})).Decode(&doc)
	return doc.Avatar
}
