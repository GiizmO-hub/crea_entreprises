# 🔐 Guide Configuration SSH pour GitHub

## ✅ Étape 1 : Clé SSH générée

Votre clé SSH a été générée avec succès :
- **Clé privée** : `~/.ssh/id_ed25519`
- **Clé publique** : `~/.ssh/id_ed25519.pub`

## 📋 Étape 2 : Ajouter la clé à GitHub

### Méthode 1 : Via le navigateur

1. **Copiez votre clé publique** :
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
   
   Ou elle est déjà copiée dans le presse-papiers (macOS).

2. **Allez sur GitHub** :
   👉 https://github.com/settings/keys

3. **Cliquez sur "New SSH key"**

4. **Remplissez le formulaire** :
   - **Title** : Exemple : "MacBook Air - Crea+Entreprises"
   - **Key** : Collez votre clé publique (commence par `ssh-ed25519`)
   - **Key type** : Authentication Key
   
5. **Cliquez sur "Add SSH key"**

6. **Entrez votre mot de passe GitHub** pour confirmer

### Méthode 2 : Via la ligne de commande (GitHub CLI)

Si vous avez GitHub CLI installé :
```bash
gh auth login
gh ssh-key add ~/.ssh/id_ed25519.pub --title "MacBook Air"
```

## ✅ Étape 3 : Tester la connexion

Une fois la clé ajoutée à GitHub, testez la connexion :

```bash
ssh -T git@github.com
```

Vous devriez voir :
```
Hi GiizmO-hub! You've successfully authenticated, but GitHub does not provide shell access.
```

## 🚀 Étape 4 : Pousser le code

Le remote Git est déjà configuré en SSH :
```bash
cd /Users/user/Downloads/cursor
git push origin main
```

## 🔧 Dépannage

### Si la connexion SSH échoue

1. **Vérifiez que la clé est ajoutée à GitHub** :
   👉 https://github.com/settings/keys

2. **Vérifiez que l'agent SSH est actif** :
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

3. **Testez à nouveau** :
   ```bash
   ssh -T git@github.com
   ```

### Si vous avez plusieurs clés SSH

Créez un fichier `~/.ssh/config` :
```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  AddKeysToAgent yes
  UseKeychain yes
```

---

**Votre clé publique SSH** :
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE4INJhAJqOfzYMSlNQlWoq+aWvg7BQQeE20z5xe82Rk giizmo@github
```

Copiez cette clé et ajoutez-la à votre compte GitHub : https://github.com/settings/keys


