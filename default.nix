let
  holonixPath = (import ./nix/sources.nix).holonix; # points to the current state of the Holochain repository
  holonix = import (holonixPath) {
    rustVersion = {
      track = "stable";
      version = "1.64.0";
    };

    holochainVersionId = "main"; # specifies the Holochain version
  };
  nixpkgs = holonix.pkgs;
in nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
  packages = with nixpkgs; [
    niv
    nodejs-18_x
    # any additional packages needed for this project, e. g. Nodejs
  ];
}